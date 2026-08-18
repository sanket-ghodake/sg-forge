import { getSession } from "@backend/auth/sessionManager";
import { validateAppAccess } from "@backend/middleware/proxyGuard";
import { db } from "@database/connection";
import crypto from "crypto";
import { sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { slug } = body;
    if (!slug) {
      return NextResponse.json({ error: "Missing app slug" }, { status: 400 });
    }

    // Validate user access to the app
    const hasAccess = await validateAppAccess(session.id, session.role, slug);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Forbidden: Access to this application is restricted" },
        { status: 403 },
      );
    }

    // 1. Fetch app details from DB
    const appResult = await db.execute(sql`
      SELECT id, scopes FROM forge_apps WHERE slug = ${slug} AND is_enabled = true
    `);
    const appRows = appResult.rows || appResult;
    if (!appRows || appRows.length === 0) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }
    const app = appRows[0] as any;

    // 2. Generate temporary code
    const code = "auth_code_" + crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 1000); // 30 seconds (standard OAuth 2.1 BCP)

    // 3. Save to database
    await db.execute(sql`
      INSERT INTO forge_auth_codes (code, app_id, user_id, expires_at, scope)
      VALUES (${code}, ${app.id}, ${session.id}, ${expiresAt.toISOString()}, ${JSON.stringify(app.scopes || [])}::jsonb)
    `);

    return NextResponse.json({ code });
  } catch (error: any) {
    console.error("Handshake API error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
