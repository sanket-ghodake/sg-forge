import { hasAppAccess } from "@backend/auth/permissionEngine";
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

    const userId = session.id;

    // Fetch user details for target rules evaluation
    const userResult = await db.execute(sql`
      SELECT u.vertical_id as "verticalId", u.designation_id as "designationId", dm.name as designation
      FROM users u
      LEFT JOIN structural_metadata dm ON u.designation_id = dm.id
      WHERE u.id = ${userId}
    `);
    const userRows = userResult.rows || userResult;
    if (!userRows || userRows.length === 0) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }
    const user = userRows[0] as any;

    const getJobLevelByName = (name: string): number => {
      const n = name.toLowerCase();
      if (n.includes("ceo")) return 5;
      if (n.includes("vp") || n.includes("cfo")) return 4;
      if (n.includes("manager")) return 3;
      if (n.includes("senior") || n.includes("sr")) return 2;
      return 1;
    };
    const userJobLevel = getJobLevelByName(user.designation || "Staff Member");

    // Fetch all unresolved requests for this user
    const unresolvedRequestsResult = await db.execute(sql`
      SELECT app_id FROM forge_app_access_requests
      WHERE requester_id = ${userId}
        AND status IN ('pending_manager', 'pending_app_admin', 'pending_super_admin')
    `);
    const unresolvedAppIds = new Set(
      ((unresolvedRequestsResult.rows || unresolvedRequestsResult) as any[]).map((r) => r.app_id),
    );

    // Fetch all active/enabled apps
    const allAppsResult = await db.execute(sql`
      SELECT id, slug, name, entry_url as "entryUrl", target_rules as "targetRules", is_enabled as "isEnabled"
      FROM forge_apps
      WHERE is_enabled = true
    `);
    const appsRows = (allAppsResult.rows || allAppsResult) as any[];

    const enabledApps: any[] = [];
    const requestableApps: any[] = [];
    const unavailableApps: any[] = [];

    for (const app of appsRows) {
      const hasAccess = await hasAppAccess(userId, app.id);

      const appPayload = {
        id: app.id,
        slug: app.slug,
        name: app.name,
        entryUrl: app.entryUrl,
        targetRules: app.targetRules,
        hasPendingRequest: unresolvedAppIds.has(app.id),
      };

      if (hasAccess) {
        enabledApps.push(appPayload);
      } else {
        // Evaluate if user is eligible to request it based on target designation levels/verticals
        const rules = (app.targetRules || {}) as any;
        let isEligible = true;

        // Verticals check
        if (rules.verticals && rules.verticals.length > 0 && !rules.verticals.includes("all")) {
          const targetVerticals = rules.verticals.map((v: string) => {
            if (v === "core-tech-uuid-placeholder") return "10000000-0000-0000-0000-000000000002";
            if (v === "exec-uuid-placeholder") return "10000000-0000-0000-0000-000000000001";
            return v;
          });
          if (!targetVerticals.includes(user.verticalId)) {
            isEligible = false;
          }
        }

        // Designation check
        if (isEligible && rules.designations && rules.designations.length > 0) {
          if (!rules.designations.includes(user.designationId)) {
            isEligible = false;
          }
        }

        // Min Job Level check
        if (isEligible) {
          const minJobLevel = rules.minJobLevel !== undefined ? Number(rules.minJobLevel) : 1;
          if (userJobLevel < minJobLevel) {
            isEligible = false;
          }
        }

        if (isEligible) {
          requestableApps.push(appPayload);
        } else {
          unavailableApps.push(appPayload);
        }
      }
    }

    return NextResponse.json({
      enabledApps,
      requestableApps,
      unavailableApps,
    });
  } catch (error: any) {
    console.error("Marketplace apps fetch error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
