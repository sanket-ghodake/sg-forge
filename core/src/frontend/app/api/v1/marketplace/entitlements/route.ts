import { clearPermissionCache } from "@backend/auth/permissionEngine";
import { getSession } from "@backend/auth/sessionManager";
import { db } from "@database/connection";
import { sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

// GET /api/v1/marketplace/entitlements
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session || (session.role !== "super_admin" && session.role !== "admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let query;
    if (session.role === "super_admin") {
      query = sql`
        SELECT 
          e.id, 
          e.app_id as "appId", 
          e.subject_type as "subjectType", 
          e.subject_id as "subjectId", 
          e.access_type as "accessType", 
          e.created_at as "createdAt",
          a.name as "appName",
          u.name as "userName",
          u.eid as "userEid",
          n.name as "nodeName",
          n.metadata->>'type' as "nodeType",
          gb.name as "grantedByName"
        FROM forge_app_entitlements e
        INNER JOIN forge_apps a ON e.app_id = a.id
        LEFT JOIN users u ON e.subject_id = u.id AND e.subject_type = 'user'
        LEFT JOIN org_nodes n ON e.subject_id = n.id AND e.subject_type = 'org_node'
        LEFT JOIN users gb ON e.granted_by = gb.id
        WHERE e.status = 'active' AND (e.expires_at IS NULL OR e.expires_at > NOW())
        ORDER BY e.created_at DESC
      `;
    } else {
      query = sql`
        SELECT 
          e.id, 
          e.app_id as "appId", 
          e.subject_type as "subjectType", 
          e.subject_id as "subjectId", 
          e.access_type as "accessType", 
          e.created_at as "createdAt",
          a.name as "appName",
          u.name as "userName",
          u.eid as "userEid",
          n.name as "nodeName",
          n.metadata->>'type' as "nodeType",
          gb.name as "grantedByName"
        FROM forge_app_entitlements e
        INNER JOIN forge_apps a ON e.app_id = a.id
        INNER JOIN forge_app_admins adm ON e.app_id = adm.app_id
        LEFT JOIN users u ON e.subject_id = u.id AND e.subject_type = 'user'
        LEFT JOIN org_nodes n ON e.subject_id = n.id AND e.subject_type = 'org_node'
        LEFT JOIN users gb ON e.granted_by = gb.id
        WHERE adm.user_id = ${session.id}
          AND e.status = 'active' AND (e.expires_at IS NULL OR e.expires_at > NOW())
        ORDER BY e.created_at DESC
      `;
    }

    const entitlementsResult = await db.execute(query);
    const entitlements = (entitlementsResult.rows || entitlementsResult) as any[];

    return NextResponse.json({
      success: true,
      entitlements,
    });
  } catch (error: any) {
    console.error("List entitlements API error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/v1/marketplace/entitlements?id=...
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session || (session.role !== "super_admin" && session.role !== "admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const entitlementId = searchParams.get("id");

    if (!entitlementId) {
      return NextResponse.json({ error: "Missing entitlement ID" }, { status: 400 });
    }

    if (session.role !== "super_admin") {
      const authCheck = await db.execute(sql`
        SELECT 1 
        FROM forge_app_entitlements e
        INNER JOIN forge_app_admins adm ON e.app_id = adm.app_id
        WHERE e.id = ${entitlementId} AND adm.user_id = ${session.id}
      `);
      const authRows = authCheck.rows || authCheck;
      if (!authRows || authRows.length === 0) {
        return NextResponse.json(
          {
            error: "Forbidden: You are not authorized to revoke entitlements for this application",
          },
          { status: 403 },
        );
      }
    }

    const reason = searchParams.get("reason") || "Administrative revocation";

    await db.execute(sql`
      UPDATE forge_app_entitlements
      SET 
        status = 'revoked',
        revoked_at = NOW(),
        revoked_by = ${session.id},
        revocation_reason = ${reason}
      WHERE id = ${entitlementId}
    `);

    clearPermissionCache();

    return NextResponse.json({
      success: true,
      message: "Entitlement revoked successfully",
    });
  } catch (error: any) {
    console.error("Revoke entitlement API error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
