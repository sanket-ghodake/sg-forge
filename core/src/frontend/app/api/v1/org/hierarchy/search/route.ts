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

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ success: true, employees: [], departments: [] });
    }

    const searchPattern = `%${query.trim()}%`;

    // 1. Search for employees
    const searchResult = await db.execute(sql`
      SELECT 
        u.id, 
        u.eid, 
        u.name, 
        u.email, 
        u.role,
        dm.name as designation, 
        vm.name as "verticalName"
      FROM users u
      LEFT JOIN structural_metadata dm ON u.designation_id = dm.id
      LEFT JOIN structural_metadata vm ON u.vertical_id = vm.id
      WHERE u.name ILIKE ${searchPattern}
         OR u.email ILIKE ${searchPattern}
         OR u.eid ILIKE ${searchPattern}
      ORDER BY u.name ASC
      LIMIT 20
    `);

    const employees = (searchResult.rows || searchResult) as any[];

    // 2. Search for departments (verticals)
    const deptsResult = await db.execute(sql`
      SELECT id, name
      FROM structural_metadata
      WHERE type = 'vertical' AND name ILIKE ${searchPattern}
      ORDER BY name ASC
      LIMIT 10
    `);
    const matchingDepts = (deptsResult.rows || deptsResult) as any[];

    const departments = [];
    for (const dept of matchingDepts) {
      const headResult = await db.execute(sql`
        SELECT u.id, u.name, dm.name as designation
        FROM users u
        LEFT JOIN structural_metadata dm ON u.designation_id = dm.id
        WHERE u.vertical_id = ${dept.id}
        ORDER BY u.job_level DESC, u.name ASC
        LIMIT 1
      `);
      const headRows = (headResult.rows || headResult) as any[];
      if (headRows && headRows.length > 0) {
        departments.push({
          id: dept.id,
          name: dept.name,
          headUserId: headRows[0].id,
          headUserName: headRows[0].name,
          headDesignation: headRows[0].designation,
        });
      } else {
        departments.push({
          id: dept.id,
          name: dept.name,
          headUserId: null,
          headUserName: null,
          headDesignation: null,
        });
      }
    }

    return NextResponse.json({
      success: true,
      employees,
      departments,
    });
  } catch (error: any) {
    console.error("Org hierarchy search API error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
