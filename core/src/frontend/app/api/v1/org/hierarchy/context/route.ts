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

    // Get search param for focused userId (defaults to the logged-in session user)
    const { searchParams } = new URL(request.url);
    let targetUserId = searchParams.get("userId");

    if (!targetUserId) {
      const session = await getSession(request);
      if (session) {
        targetUserId = session.id;
      }
    }

    if (!targetUserId) {
      return NextResponse.json({ error: "Missing userId parameter" }, { status: 400 });
    }

    // 1. Fetch the focal employee's profile details
    const userResult = await db.execute(sql`
      SELECT 
        u.id, 
        u.eid, 
        u.name, 
        u.email, 
        u.role, 
        u.manager_id as "managerId",
        dm.name as designation, 
        vm.name as "verticalName"
      FROM users u
      LEFT JOIN structural_metadata dm ON u.designation_id = dm.id
      LEFT JOIN structural_metadata vm ON u.vertical_id = vm.id
      WHERE u.id = ${targetUserId}
    `);
    const userRows = userResult.rows || userResult;
    if (!userRows || userRows.length === 0) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }
    const focalUser = userRows[0] as any;

    // 2. Fetch the linear parent chain (managers up to the CEO)
    let parentChain: any[] = [];
    if (focalUser.managerId) {
      const chainResult = await db.execute(sql`
        WITH RECURSIVE manager_chain AS (
          SELECT id, name, manager_id, designation_id, vertical_id, eid, email, 1 as level
          FROM users
          WHERE id = ${focalUser.managerId}

          UNION ALL

          SELECT u.id, u.name, u.manager_id, u.designation_id, u.vertical_id, u.eid, u.email, mc.level + 1
          FROM users u
          INNER JOIN manager_chain mc ON u.id = mc.manager_id
        )
        SELECT 
          mc.id, 
          mc.name, 
          mc.manager_id as "managerId", 
          mc.eid, 
          mc.email, 
          mc.level,
          sm.name as designation, 
          vm.name as "verticalName"
        FROM manager_chain mc
        LEFT JOIN structural_metadata sm ON mc.designation_id = sm.id
        LEFT JOIN structural_metadata vm ON mc.vertical_id = vm.id
        ORDER BY mc.level DESC
      `);
      parentChain = (chainResult.rows || chainResult) as any[];
    }

    // 3. Fetch direct reports (descending one level)
    const reportsResult = await db.execute(sql`
      SELECT 
        u.id, 
        u.eid, 
        u.name, 
        u.email, 
        u.role,
        u.manager_id as "managerId",
        dm.name as designation, 
        vm.name as "verticalName"
      FROM users u
      LEFT JOIN structural_metadata dm ON u.designation_id = dm.id
      LEFT JOIN structural_metadata vm ON u.vertical_id = vm.id
      WHERE u.manager_id = ${targetUserId}
      ORDER BY u.name ASC
    `);
    const directReports = (reportsResult.rows || reportsResult) as any[];

    // 4. Fetch peers (sharing the same manager)
    let peers: any[] = [];
    if (focalUser.managerId) {
      const peersResult = await db.execute(sql`
        SELECT 
          u.id, 
          u.eid, 
          u.name, 
          u.email, 
          u.role,
          u.manager_id as "managerId",
          dm.name as designation, 
          vm.name as "verticalName"
        FROM users u
        LEFT JOIN structural_metadata dm ON u.designation_id = dm.id
        LEFT JOIN structural_metadata vm ON u.vertical_id = vm.id
        WHERE u.manager_id = ${focalUser.managerId} AND u.id != ${targetUserId}
        ORDER BY u.name ASC
      `);
      peers = (peersResult.rows || peersResult) as any[];
    } else {
      // CEO level: peers are other root-level executives with no manager
      const peersResult = await db.execute(sql`
        SELECT 
          u.id, 
          u.eid, 
          u.name, 
          u.email, 
          u.role,
          u.manager_id as "managerId",
          dm.name as designation, 
          vm.name as "verticalName"
        FROM users u
        LEFT JOIN structural_metadata dm ON u.designation_id = dm.id
        LEFT JOIN structural_metadata vm ON u.vertical_id = vm.id
        WHERE u.manager_id IS NULL AND u.id != ${targetUserId}
        ORDER BY u.name ASC
      `);
      peers = (peersResult.rows || peersResult) as any[];
    }

    return NextResponse.json({
      success: true,
      user: focalUser,
      parentChain,
      peers,
      directReports,
    });
  } catch (error: any) {
    console.error("Org hierarchy context API error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
