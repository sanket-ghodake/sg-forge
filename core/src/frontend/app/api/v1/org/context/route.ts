import { getSession } from "@backend/auth/sessionManager";
import { verifyToken } from "@backend/auth/tokenVerifier";
import { db } from "@database/connection";
import { sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    let userId: string | null = null;
    let scopes: string[] = [];

    // 1. Try bearer token auth
    const authHeader = request.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const verified = await verifyToken(authHeader);
        userId = verified.userId;
        scopes = verified.scopes;

        // Enforce scopes if bearer token is used
        if (
          !scopes.includes("org.nodes.read") &&
          !scopes.includes("org.users.read") &&
          !scopes.includes("user.profile.read")
        ) {
          return NextResponse.json({ error: "Insufficient scopes" }, { status: 403 });
        }
      } catch (err: any) {
        // Fallback to session cookie if bearer token validation fails
      }
    }

    // 2. Fallback to session token cookie
    if (!userId) {
      const session = await getSession(request);
      if (session) {
        userId = session.id;
      }
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 3. Query user profile, designation, and manager details
    const userResult = await db.execute(sql`
      SELECT 
        u.id, 
        u.name, 
        u.manager_id as "managerId",
        dm.id as "designationId",
        dm.name as "designationName"
      FROM users u
      LEFT JOIN structural_metadata dm ON u.designation_id = dm.id
      WHERE u.id = ${userId}
    `);
    const userRows = userResult.rows || userResult;
    if (!userRows || userRows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const user = userRows[0] as any;

    // Parse designation level (e.g. "L6 Engineering Manager" -> 6)
    const levelMatch = user.designationName?.match(/L(\d+)/);
    const designationLevel = levelMatch ? parseInt(levelMatch[1], 10) : 0;

    // 4. Fetch Primary Org Node
    const primaryNodeResult = await db.execute(sql`
      SELECT n.id, n.name, t.name as "type"
      FROM user_org_nodes uon
      INNER JOIN org_nodes n ON uon.node_id = n.id
      INNER JOIN org_node_types t ON n.node_type_id = t.id
      WHERE uon.user_id = ${userId} AND uon.is_primary = true
      LIMIT 1
    `);
    const primaryNodeRows = primaryNodeResult.rows || primaryNodeResult;
    const primaryOrgNode =
      primaryNodeRows && primaryNodeRows.length > 0
        ? {
            id: primaryNodeRows[0].id,
            name: primaryNodeRows[0].name,
            type: primaryNodeRows[0].type,
          }
        : null;

    // 5. Fetch all teams they are member of
    const teamsResult = await db.execute(sql`
      SELECT n.name
      FROM user_org_nodes uon
      INNER JOIN org_nodes n ON uon.node_id = n.id
      INNER JOIN org_node_types t ON n.node_type_id = t.id
      WHERE uon.user_id = ${userId} AND t.name = 'team'
    `);
    const teamsRows = teamsResult.rows || teamsResult;
    const teams = (teamsRows || []).map((row: any) => row.name);

    // 6. Fetch matrix project codes
    const projectsResult = await db.execute(sql`
      SELECT p.code
      FROM project_members pm
      INNER JOIN projects p ON pm.project_id = p.id
      WHERE pm.user_id = ${userId}
    `);
    const projectsRows = projectsResult.rows || projectsResult;
    const projects = (projectsRows || []).map((row: any) => row.code);

    // 7. Check if user has management responsibilities
    // Level 6+ or having a "manager" or "lead" role in any org node
    const orgRoleResult = await db.execute(sql`
      SELECT 1 
      FROM user_org_nodes 
      WHERE user_id = ${userId} AND role_type IN ('manager', 'lead')
      LIMIT 1
    `);
    const orgRoleRows = orgRoleResult.rows || orgRoleResult;
    const isManagement = designationLevel >= 6 || (orgRoleRows && orgRoleRows.length > 0);

    return NextResponse.json({
      userId: user.id,
      name: user.name,
      designation: user.designationId
        ? {
            id: user.designationId,
            name: user.designationName || "Staff Member",
            level: designationLevel,
          }
        : null,
      managerId: user.managerId,
      primaryOrgNode,
      teams,
      projects,
      isManagement,
    });
  } catch (error: any) {
    console.error("Org context API error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
