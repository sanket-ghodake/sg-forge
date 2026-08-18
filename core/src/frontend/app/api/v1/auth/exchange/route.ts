import { getKeys } from "@backend/auth/keyManager";
import { resolveAppPermissions } from "@backend/auth/permissionEngine";
import { decryptText } from "@backend/utils/crypto";
import { parseDbTimestamp } from "@backend/utils/date";
import { isRateLimited } from "@backend/utils/rateLimiter";
import { db } from "@database/connection";
import { sql } from "drizzle-orm";
import { SignJWT } from "jose";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const ipAddress =
    request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "127.0.0.1";

  // Apply rate limiting: max 100 requests per minute per IP in development
  const rateLimit = await isRateLimited(ipAddress, "exchange", 100, 60000);
  if (rateLimit.limited) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }

  try {
    const body = await request.json();
    const code = body.code || body.token;
    const clientId = body.client_id || body.clientId;
    const clientSecret = body.client_secret || body.clientSecret;

    if (!code) {
      return NextResponse.json({ error: "Missing code" }, { status: 400 });
    }
    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: "Missing client credentials" }, { status: 400 });
    }

    // 1. Verify app credentials, authorization code, and user profile using a single joined read query
    const dbResult = await db.execute(sql`
      SELECT 
        fa.id as "appId",
        fa.client_id as "appClientId",
        fa.client_secret as "clientSecret",
        fac.id as "authCodeId",
        fac.expires_at as "expiresAt",
        fac.used as "authCodeUsed",
        u.id as "userId",
        u.eid as "userEid",
        u.name as "userName",
        u.email as "userEmail",
        u.role as "userRole",
        dm.name as "userDesignation"
      FROM forge_apps fa
      LEFT JOIN forge_auth_codes fac ON fac.app_id = fa.id AND fac.code = ${code}
      LEFT JOIN users u ON fac.user_id = u.id
      LEFT JOIN structural_metadata dm ON u.designation_id = dm.id
      WHERE fa.client_id = ${clientId}
    `);

    const rows = dbResult.rows || dbResult;
    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "Invalid client credentials" }, { status: 401 });
    }

    const row = rows[0] as any;
    if (decryptText(row.clientSecret) !== clientSecret) {
      return NextResponse.json({ error: "Invalid client credentials" }, { status: 401 });
    }

    if (!row.authCodeId) {
      return NextResponse.json({ error: "Invalid authorization code" }, { status: 400 });
    }

    if (row.authCodeUsed) {
      return NextResponse.json({ error: "Authorization code already used" }, { status: 400 });
    }

    if (parseDbTimestamp(row.expiresAt) < new Date()) {
      return NextResponse.json({ error: "Authorization code expired" }, { status: 400 });
    }

    if (!row.userId) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 2. Mark code as used
    await db.execute(sql`
      UPDATE forge_auth_codes SET used = true WHERE id = ${row.authCodeId}
    `);

    const app = {
      id: row.appId,
      clientId: row.appClientId,
    };

    const user = {
      id: row.userId,
      eid: row.userEid,
      name: row.userName,
      email: row.userEmail,
      role: row.userRole,
      designation: row.userDesignation || "",
    };

    // Resolve intersection of app scopes and user permissions
    const authorizedScopes = await resolveAppPermissions(app.id, user.id);

    // 5. Generate signed JWT access token with 15-minute lifetime
    const activeKeys = getKeys();
    const accessToken = await new SignJWT({
      eid: user.eid,
      name: user.name,
      email: user.email,
      role: user.role,
      designation: user.designation,
      clientId: app.clientId,
      scopes: authorizedScopes,
      scope: authorizedScopes.join(" "),
    })
      .setProtectedHeader({ alg: "RS256", kid: activeKeys.jwk.kid })
      .setSubject(user.id)
      .setAudience(app.id)
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(activeKeys.privateKey);

    return NextResponse.json({
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: 900,
      user: {
        id: user.id,
        eid: user.eid,
        name: user.name,
        email: user.email,
        role: user.role,
        designation: user.designation,
      },
      scopes: authorizedScopes,
    });
  } catch (error: any) {
    console.error("Auth exchange error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
