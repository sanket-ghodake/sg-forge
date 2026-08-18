import { getKeys, getPublicKeyByKid } from "@backend/auth/keyManager";
import { parseDbTimestamp } from "@backend/utils/date";
import { db } from "@database/connection";
import { sql } from "drizzle-orm";
import { decodeProtectedHeader, jwtVerify } from "jose";

export interface VerifiedToken {
  userId: string;
  appId: string;
  scopes: string[];
}

export async function verifyToken(authHeader: string | null): Promise<VerifiedToken> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Missing or invalid authorization header");
  }
  const tokenStr = authHeader.substring(7);

  // Check if token looks like a JWT
  if (tokenStr.startsWith("eyJ") && tokenStr.split(".").length === 3) {
    try {
      const header = decodeProtectedHeader(tokenStr);
      const publicKey = getPublicKeyByKid(header.kid);
      const { payload } = await jwtVerify(tokenStr, publicKey, {
        algorithms: ["RS256"],
      });

      const userId = payload.sub as string;
      const appId = payload.aud as string;
      const scopes = (payload.scopes || payload.scope || []) as string[];

      if (!userId || !appId) {
        throw new Error("Invalid JWT payload claims");
      }

      return {
        userId,
        appId,
        scopes,
      };
    } catch (err: any) {
      throw new Error(`Invalid access token (JWT verification failed: ${err.message})`);
    }
  } else {
    // Fallback to database lookup for backward compatibility
    const tokenResult = await db.execute(sql`
      SELECT id, access_token as "accessToken", app_id as "appId", user_id as "userId", expires_at as "expiresAt", scope
      FROM forge_access_tokens
      WHERE access_token = ${tokenStr}
    `);
    const tokenRows = tokenResult.rows || tokenResult;
    if (!tokenRows || tokenRows.length === 0) {
      throw new Error("Invalid access token");
    }
    const token = tokenRows[0] as any;

    if (parseDbTimestamp(token.expiresAt) < new Date()) {
      throw new Error("Access token expired");
    }

    return {
      userId: token.userId,
      appId: token.appId,
      scopes: (token.scope || []) as string[],
    };
  }
}
