import { clearPermissionCache } from "@backend/auth/permissionEngine";
import { getSession } from "@backend/auth/sessionManager";
import { db } from "@database/connection";
import { sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session || (session.role !== "super_admin" && session.role !== "admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const appId = searchParams.get("appId");

    if (!appId) {
      return NextResponse.json({ error: "Missing appId parameter" }, { status: 400 });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    // 1. Fetch App details
    const appResult = uuidRegex.test(appId)
      ? await db.execute(sql`
          SELECT id, name, target_rules as "targetRules", is_enabled as "isEnabled"
          FROM forge_apps
          WHERE id = ${appId}
        `)
      : await db.execute(sql`
          SELECT id, name, target_rules as "targetRules", is_enabled as "isEnabled"
          FROM forge_apps
          WHERE slug = ${appId}
        `);
    const appRows = appResult.rows || appResult;
    if (!appRows || appRows.length === 0) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }
    const app = appRows[0] as any;
    const resolvedAppId = app.id;
    const rules = (app.targetRules || {}) as any;

    // 2. If logged in as admin (not super_admin), verify they are assigned to manage this app
    if (session.role !== "super_admin") {
      const adminCheck = await db.execute(sql`
        SELECT 1 FROM forge_app_admins WHERE app_id = ${resolvedAppId} AND user_id = ${session.id}
      `);
      const adminRows = adminCheck.rows || adminCheck;
      if (!adminRows || adminRows.length === 0) {
        return NextResponse.json(
          { error: "Forbidden: You are not authorized to manage this application" },
          { status: 403 },
        );
      }
    }

    // 3. Fetch all users in organization with designation & vertical info (exclude admins from org hierarchy)
    const usersResult = await db.execute(sql`
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.eid, 
        u.role, 
        u.manager_id as "managerId",
        u.designation_id as "designationId",
        u.vertical_id as "verticalId",
        dm.name as designation,
        vm.name as vertical
      FROM users u
      LEFT JOIN structural_metadata dm ON u.designation_id = dm.id
      LEFT JOIN structural_metadata vm ON u.vertical_id = vm.id
      WHERE u.role = 'user'
      ORDER BY u.name ASC
    `);
    const users = (usersResult.rows || usersResult) as any[];

    // 4. Fetch all user context lists (teams, projects, groups, org nodes) for entitlement resolution
    const contextResult = await db.execute(sql`
      SELECT 
        u.id AS "userId",
        ARRAY_AGG(DISTINCT ut.team_id) FILTER (WHERE ut.team_id IS NOT NULL) AS "teamIds",
        ARRAY_AGG(DISTINCT pm.project_id) FILTER (WHERE pm.project_id IS NOT NULL) AS "projectIds",
        ARRAY_AGG(DISTINCT ug.group_id) FILTER (WHERE ug.group_id IS NOT NULL) AS "groupIds",
        ARRAY_AGG(DISTINCT uon.node_id) FILTER (WHERE uon.node_id IS NOT NULL) AS "orgNodeIds"
      FROM users u
      LEFT JOIN user_teams ut ON ut.user_id = u.id
      LEFT JOIN project_members pm ON pm.user_id = u.id
      LEFT JOIN user_groups ug ON ug.user_id = u.id
      LEFT JOIN user_org_nodes uon ON uon.user_id = u.id
      GROUP BY u.id
    `);
    const contextRows = (contextResult.rows || contextResult) as any[];
    const contextMap = new Map(contextRows.map((c) => [c.userId, c]));

    // 5. Fetch entitlements for this app
    const entitlementsResult = await db.execute(sql`
      SELECT subject_type as "subjectType", subject_id as "subjectId", access_type as "accessType"
      FROM forge_app_entitlements
      WHERE app_id = ${resolvedAppId}
        AND status = 'active'
        AND (expires_at IS NULL OR expires_at > NOW())
    `);
    const entitlements = (entitlementsResult.rows || entitlementsResult) as any[];

    // Helper to evaluate job level
    const getJobLevelByName = (name: string): number => {
      const n = name.toLowerCase();
      if (n.includes("ceo")) return 5;
      if (n.includes("vp") || n.includes("cfo")) return 4;
      if (n.includes("manager")) return 3;
      if (n.includes("senior") || n.includes("sr")) return 2;
      return 1;
    };

    // 6. Map users to eligibility & access status
    const usersAccessList = users.map((u) => {
      // Evaluate default eligibility
      let isEligible = true;

      // Verticals Check
      if (rules.verticals && rules.verticals.length > 0 && !rules.verticals.includes("all")) {
        const targetVerticals = rules.verticals.map((v: string) => {
          if (v === "core-tech-uuid-placeholder") return "10000000-0000-0000-0000-000000000002";
          if (v === "exec-uuid-placeholder") return "10000000-0000-0000-0000-000000000001";
          return v;
        });
        if (!targetVerticals.includes(u.verticalId)) {
          isEligible = false;
        }
      }

      // Designation Check
      if (isEligible && rules.designations && rules.designations.length > 0) {
        if (!rules.designations.includes(u.designationId)) {
          isEligible = false;
        }
      }

      // Job Level Check
      if (isEligible) {
        const userJobLevel = getJobLevelByName(u.designation || "Staff Member");
        const minJobLevel = rules.minJobLevel !== undefined ? Number(rules.minJobLevel) : 1;
        if (userJobLevel < minJobLevel) {
          isEligible = false;
        }
      }

      // Check explicit entitlements
      const userCtx = contextMap.get(u.id) || {
        teamIds: [],
        projectIds: [],
        groupIds: [],
        orgNodeIds: [],
      };
      const teamIds = userCtx.teamIds || [];
      const projectIds = userCtx.projectIds || [];
      const groupIds = userCtx.groupIds || [];
      const orgNodeIds = userCtx.orgNodeIds || [];
      const designationId = u.designationId;

      const matchingPolicies = entitlements.filter((p) => {
        const sId = p.subjectId;
        if (p.subjectType === "user" && sId === u.id) return true;
        if (p.subjectType === "org_node" && (orgNodeIds.includes(sId) || teamIds.includes(sId)))
          return true;
        if (p.subjectType === "project" && projectIds.includes(sId)) return true;
        if (p.subjectType === "group" && groupIds.includes(sId)) return true;
        if (p.subjectType === "designation" && sId === designationId) return true;
        return false;
      });

      let hasAccess = isEligible;
      let entitlementSource = "default_targeting";

      // Precedence scores: lower is higher priority.
      // Deny policies are grouped first so that Deny always overrides Grant globally.
      const getPrecedenceScore = (p: any) => {
        if (p.subjectType === "user" && p.accessType === "deny") return 2;
        if (["org_node", "project", "group"].includes(p.subjectType) && p.accessType === "deny")
          return 3;
        if (p.subjectType === "designation" && p.accessType === "deny") return 4;
        if (p.subjectType === "user" && p.accessType === "grant") return 5;
        if (["org_node", "project", "group"].includes(p.subjectType) && p.accessType === "grant")
          return 6;
        if (p.subjectType === "designation" && p.accessType === "grant") return 7;
        return 99;
      };

      if (matchingPolicies.length > 0) {
        matchingPolicies.sort((a, b) => getPrecedenceScore(a) - getPrecedenceScore(b));
        const primaryPolicy = matchingPolicies[0];
        if (primaryPolicy.accessType === "deny") {
          hasAccess = false;
          entitlementSource = "explicit_deny";
        } else if (primaryPolicy.accessType === "grant") {
          hasAccess = true;
          entitlementSource = "explicit_grant";
        }
      }

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        eid: u.eid,
        role: u.role,
        managerId: u.managerId,
        designation: u.designation,
        vertical: u.vertical,
        isEligible,
        hasAccess,
        entitlementSource,
      };
    });

    return NextResponse.json({
      success: true,
      app: {
        id: resolvedAppId,
        name: app.name,
        isEnabled: app.isEnabled,
        targetRules: rules,
      },
      users: usersAccessList,
    });
  } catch (error: any) {
    console.error("Fetch app users access error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session || (session.role !== "super_admin" && session.role !== "admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { appId, userId, action, scope } = await request.json();

    if (!appId || !userId || !action) {
      return NextResponse.json(
        { error: "Missing parameters: appId, userId, or action" },
        { status: 400 },
      );
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    // 1. Resolve App ID
    const appResult = uuidRegex.test(appId)
      ? await db.execute(sql`SELECT id FROM forge_apps WHERE id = ${appId}`)
      : await db.execute(sql`SELECT id FROM forge_apps WHERE slug = ${appId}`);
    const appRows = appResult.rows || appResult;
    if (!appRows || appRows.length === 0) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }
    const resolvedAppId = appRows[0].id as string;

    // 2. Authorization check if not super_admin
    if (session.role !== "super_admin") {
      const adminCheck = await db.execute(sql`
        SELECT 1 FROM forge_app_admins WHERE app_id = ${resolvedAppId} AND user_id = ${session.id}
      `);
      const adminRows = adminCheck.rows || adminCheck;
      if (!adminRows || adminRows.length === 0) {
        return NextResponse.json(
          { error: "Forbidden: You are not authorized to manage this app" },
          { status: 403 },
        );
      }
    }

    // 3. Find target users (either single user, or recursive subtree)
    let targetUserIds: string[] = [userId];

    if (scope === "subtree") {
      const subtreeResult = await db.execute(sql`
        WITH RECURSIVE reports AS (
          SELECT id FROM users WHERE id = ${userId}
          UNION ALL
          SELECT u.id FROM users u INNER JOIN reports r ON u.manager_id = r.id
        )
        SELECT id FROM reports
      `);
      const rows = (subtreeResult.rows || subtreeResult) as any[];
      targetUserIds = rows.map((r) => r.id);
    }

    // 4. Update entitlements inside a transaction
    await db.transaction(async (tx) => {
      for (const uId of targetUserIds) {
        // Soft-revoke any active user-level entitlements first
        await tx.execute(sql`
          UPDATE forge_app_entitlements 
          SET 
            status = 'revoked',
            revoked_at = NOW(),
            revoked_by = ${session.id},
            revocation_reason = 'Superseded by administrative update'
          WHERE app_id = ${resolvedAppId} AND subject_type = 'user' AND subject_id = ${uId} AND status = 'active'
        `);

        if (action === "grant") {
          // Add explicit grant
          await tx.execute(sql`
            INSERT INTO forge_app_entitlements (app_id, subject_type, subject_id, access_type, granted_by, status)
            VALUES (${resolvedAppId}, 'user', ${uId}, 'grant', ${session.id}, 'active')
          `);
        } else if (action === "revoke") {
          // Add explicit deny
          await tx.execute(sql`
            INSERT INTO forge_app_entitlements (app_id, subject_type, subject_id, access_type, granted_by, status)
            VALUES (${resolvedAppId}, 'user', ${uId}, 'deny', ${session.id}, 'active')
          `);
        }
      }
    });

    clearPermissionCache();

    return NextResponse.json({ success: true, affectedCount: targetUserIds.length });
  } catch (error: any) {
    console.error("Update app access entitlements error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
