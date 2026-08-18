import { getSession } from "@backend/auth/sessionManager";
import { verifyToken } from "@backend/auth/tokenVerifier";
import { db } from "@database/connection";
import { sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate the requester
    let isAuthorized = false;
    const authHeader = request.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        await verifyToken(authHeader);
        isAuthorized = true;
      } catch (err: any) {
        // Fallback to session cookie if bearer token validation fails
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

    // 2. Parse request query parameters
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employee_id");
    const managerId = searchParams.get("manager_id");

    if (!employeeId || !managerId) {
      return NextResponse.json(
        { error: "Missing employee_id or manager_id parameter" },
        { status: 400 },
      );
    }

    // 3. Recursive query to resolve reporting chain lineage
    const result = await db.execute(sql`
      WITH RECURSIVE reporting_chain AS (
        SELECT id, manager_id, 1 as distance
        FROM users
        WHERE id = ${employeeId}

        UNION ALL

        SELECT u.id, u.manager_id, rc.distance + 1
        FROM users u
        INNER JOIN reporting_chain rc ON rc.manager_id = u.id
        WHERE rc.manager_id IS NOT NULL AND rc.manager_id != rc.id -- Safety guard against loops
      )
      SELECT distance
      FROM reporting_chain
      WHERE manager_id = ${managerId}
      LIMIT 1
    `);

    const rows = (result.rows || result) as any[];
    if (rows && rows.length > 0) {
      const distance = parseInt(rows[0].distance, 10);
      return NextResponse.json({
        isDirectReport: distance === 1,
        isIndirectReport: distance > 1,
        reportingDistance: distance,
      });
    }

    return NextResponse.json({
      isDirectReport: false,
      isIndirectReport: false,
      reportingDistance: null,
    });
  } catch (error: any) {
    console.error("Verify relationship API error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
