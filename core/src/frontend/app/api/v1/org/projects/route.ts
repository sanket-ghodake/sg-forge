import { getSession } from "@backend/auth/sessionManager";
import { verifyToken } from "@backend/auth/tokenVerifier";
import { db } from "@database/connection";
import { sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    let isAuthorized = false;
    const authHeader = request.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        await verifyToken(authHeader);
        isAuthorized = true;
      } catch (err: any) {
        // Fallback to session cookie
      }
    }

    if (!isAuthorized) {
      const session = await getSession(request);
      if (session) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectsResult = await db.execute(sql`
      SELECT id, name, code, description, status FROM projects ORDER BY name ASC
    `);
    const projects = (projectsResult.rows || projectsResult) as any[];

    return NextResponse.json({
      success: true,
      projects,
    });
  } catch (error: any) {
    console.error("Projects API error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
