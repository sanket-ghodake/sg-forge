import { getSession } from "@backend/auth/sessionManager";
import { db } from "@database/connection";
import { sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") || "all";

    let query;
    if (session.role === "super_admin") {
      query = sql`
        SELECT 
          r.id, 
          r.app_id as "appId", 
          a.name as "appName", 
          r.requester_id as "requesterId", 
          u.name as "requesterName", 
          u.manager_id as "managerId",
          r.reason, 
          r.scope, 
          r.target_entity_id as "targetEntityId", 
          r.status, 
          r.created_at as "createdAt",
          r.manager_notes as "managerNotes",
          r.app_admin_notes as "appAdminNotes",
          r.super_admin_notes as "superAdminNotes"
        FROM forge_app_access_requests r
        INNER JOIN forge_apps a ON r.app_id = a.id
        INNER JOIN users u ON r.requester_id = u.id
        WHERE (${filter} != 'pending' OR r.status IN ('pending_manager', 'pending_app_admin', 'pending_super_admin'))
        ORDER BY r.created_at DESC
      `;
    } else {
      // Fetch report users (recursive)
      const reportsRes = await db.execute(sql`
        WITH RECURSIVE reports AS (
          SELECT id FROM users WHERE manager_id = ${session.id}
          UNION ALL
          SELECT u.id FROM users u INNER JOIN reports r ON u.manager_id = r.id
        )
        SELECT id FROM reports
      `);
      const reportsRows = (reportsRes.rows || reportsRes) as any[];
      const reportUserIds = (reportsRows || []).map((row: any) => row.id);

      // Fetch admin app ids
      const adminAppsRes = await db.execute(sql`
        SELECT app_id FROM forge_app_admins WHERE user_id = ${session.id}
      `);
      const adminAppsRows = (adminAppsRes.rows || adminAppsRes) as any[];
      const adminAppIds = (adminAppsRows || []).map((row: any) => row.app_id);

      const conditions = [];
      conditions.push(sql`r.requester_id = ${session.id}`);
      if (reportUserIds.length > 0) {
        const idsList = sql.join(
          reportUserIds.map((id) => sql`${id}`),
          sql`, `,
        );
        conditions.push(sql`r.requester_id IN (${idsList})`);
      }
      if (adminAppIds.length > 0) {
        const idsList = sql.join(
          adminAppIds.map((id) => sql`${id}`),
          sql`, `,
        );
        conditions.push(sql`r.app_id IN (${idsList})`);
      }

      const orClause = sql.join(conditions, sql` OR `);

      query = sql`
        SELECT 
          r.id, 
          r.app_id as "appId", 
          a.name as "appName", 
          r.requester_id as "requesterId", 
          u.name as "requesterName", 
          u.manager_id as "managerId",
          r.reason, 
          r.scope, 
          r.target_entity_id as "targetEntityId", 
          r.status, 
          r.created_at as "createdAt",
          r.manager_notes as "managerNotes",
          r.app_admin_notes as "appAdminNotes",
          r.super_admin_notes as "superAdminNotes"
        FROM forge_app_access_requests r
        INNER JOIN forge_apps a ON r.app_id = a.id
        INNER JOIN users u ON r.requester_id = u.id
        WHERE (${orClause})
          AND (${filter} != 'pending' OR r.status IN ('pending_manager', 'pending_app_admin', 'pending_super_admin'))
        ORDER BY r.created_at DESC
      `;
    }

    const result = await db.execute(query);
    const requests = result.rows || result;

    return NextResponse.json({ requests });
  } catch (error: any) {
    console.error("Fetch access requests error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
