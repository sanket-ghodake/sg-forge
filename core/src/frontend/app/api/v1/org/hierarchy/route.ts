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

    // Fetch all node types for quick lookup
    const typesResult = await db.execute(sql`
      SELECT id, name, sort_order as "sortOrder" FROM org_node_types ORDER BY sort_order ASC
    `);
    const types = (typesResult.rows || typesResult) as any[];

    // Fetch all organization nodes
    const nodesResult = await db.execute(sql`
      SELECT 
        n.id, 
        n.name, 
        n.parent_id as "parentId", 
        n.node_type_id as "nodeTypeId",
        n.path,
        t.name as "type"
      FROM org_nodes n
      INNER JOIN org_node_types t ON n.node_type_id = t.id
      ORDER BY n.name ASC
    `);
    const nodes = (nodesResult.rows || nodesResult) as any[];

    // Fetch all members mapping
    const membersResult = await db.execute(sql`
      SELECT 
        uon.node_id as "orgNodeId", 
        uon.role_type as "relationship",
        uon.is_primary as "isPrimary",
        u.id as "userId",
        u.name as "userName",
        u.email,
        u.eid,
        sm.name as "designation"
      FROM user_org_nodes uon
      INNER JOIN users u ON uon.user_id = u.id
      LEFT JOIN structural_metadata sm ON u.designation_id = sm.id
      ORDER BY u.name ASC
    `);
    const members = (membersResult.rows || membersResult) as any[];

    // Group members by node ID
    const membersByNode: Record<string, any[]> = {};
    members.forEach((member) => {
      if (!membersByNode[member.orgNodeId]) {
        membersByNode[member.orgNodeId] = [];
      }
      membersByNode[member.orgNodeId].push({
        id: member.userId,
        name: member.userName,
        email: member.email,
        eid: member.eid,
        designation: member.designation,
        relationship: member.relationship,
        isPrimary: member.isPrimary,
      });
    });

    // Enrich nodes with members
    const enrichedNodes = nodes.map((node) => ({
      ...node,
      members: membersByNode[node.id] || [],
    }));

    return NextResponse.json({
      success: true,
      nodeTypes: types,
      nodes: enrichedNodes,
    });
  } catch (error: any) {
    console.error("Org hierarchy tree API error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
