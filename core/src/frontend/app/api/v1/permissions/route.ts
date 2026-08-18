import { resolveUserPermissions } from "@backend/auth/permissionEngine";
import { verifyToken } from "@backend/auth/tokenVerifier";
import { db } from "@database/connection";
import { sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    let userId: string;
    let authorizedScopes: string[];
    try {
      const verified = await verifyToken(authHeader);
      userId = verified.userId;
      authorizedScopes = verified.scopes;
    } catch (err: any) {
      return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
    }

    // 2. Resolve user's permissions
    const userPermissions = await resolveUserPermissions(userId);

    return NextResponse.json({
      permissions: userPermissions,
      scopes: authorizedScopes,
    });
  } catch (error: any) {
    console.error("Fetch permissions error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
