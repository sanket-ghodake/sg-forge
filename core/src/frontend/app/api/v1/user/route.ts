import { getHierarchyLevel } from "@backend/api/user/portal";
import { verifyToken } from "@backend/auth/tokenVerifier";
import { db } from "@database/connection";
import { sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    let userId: string;
    let scopes: string[];
    try {
      const verified = await verifyToken(authHeader);
      userId = verified.userId;
      scopes = verified.scopes;
    } catch (err: any) {
      return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
    }

    if (!scopes.includes("user.profile.read")) {
      return NextResponse.json(
        { error: "Insufficient scopes (user.profile.read required)" },
        { status: 403 },
      );
    }

    // 2. Fetch user information
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
      WHERE u.id = ${userId}
    `);
    const userRows = userResult.rows || userResult;
    if (!userRows || userRows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const rawUser = userRows[0] as any;
    const hierarchyLevel = await getHierarchyLevel(userId);

    const userProfile: any = {
      id: rawUser.id,
      eid: rawUser.eid,
      name: rawUser.name,
      email: rawUser.email,
      role: rawUser.role,
      designation: rawUser.designation || "Staff Member",
      verticalName: rawUser.verticalName || "Corporate",
      hierarchyLevel,
    };

    // Include manager details only if user.manager.read scope is present
    if (scopes.includes("user.manager.read") && rawUser.managerId) {
      const managerResult = await db.execute(sql`
        SELECT 
          u.id, 
          u.eid, 
          u.name, 
          u.email, 
          dm.name as designation
        FROM users u
        LEFT JOIN structural_metadata dm ON u.designation_id = dm.id
        WHERE u.id = ${rawUser.managerId}
      `);
      const managerRows = managerResult.rows || managerResult;
      if (managerRows && managerRows.length > 0) {
        const mgr = managerRows[0] as any;
        userProfile.manager = {
          id: mgr.id,
          eid: mgr.eid,
          name: mgr.name,
          email: mgr.email,
          designation: mgr.designation || "Executive",
        };
      } else {
        userProfile.manager = null;
      }
    }

    return NextResponse.json({ user: userProfile });
  } catch (error: any) {
    console.error("Fetch user details error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
