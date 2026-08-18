import { db } from "@database/connection";
import { sql } from "drizzle-orm";

export function getJobLevelByName(name: string): number {
  const n = name.toLowerCase();
  if (n.includes("ceo")) return 5;
  if (n.includes("vp") || n.includes("cfo")) return 4;
  if (n.includes("manager")) return 3;
  if (n.includes("senior") || n.includes("sr")) return 2;
  return 1;
}

export async function validateAppAccess(
  userId: string,
  userRole: string,
  appSlug: string,
): Promise<boolean> {
  // If super_admin, permit access
  if (userRole === "super_admin") {
    return true;
  }

  // 1. Fetch app target rules and is_enabled status
  const appResult = await db.execute(sql`
    SELECT id, target_rules as "targetRules", is_enabled as "isEnabled" FROM forge_apps WHERE slug = ${appSlug}
  `);
  const appRows = appResult.rows || appResult;
  if (!appRows || appRows.length === 0) {
    return true; // Let route handler handle non-existent app (404)
  }
  const app = appRows[0] as any;
  if (!app.isEnabled) {
    return true; // Let route handler handle disabled app status codes
  }

  const rules =
    (typeof app.targetRules === "string" ? JSON.parse(app.targetRules) : app.targetRules) || {};

  // 2. Fetch user metadata
  const userResult = await db.execute(sql`
    SELECT 
      u.role, 
      u.vertical_id as "verticalId",
      u.designation_id as "designationId",
      dm.name as designation
    FROM users u
    LEFT JOIN structural_metadata dm ON u.designation_id = dm.id
    WHERE u.id = ${userId}
  `);
  const userRows = userResult.rows || userResult;
  if (!userRows || userRows.length === 0) {
    return false;
  }
  const user = userRows[0] as any;

  // 3. Role-based checks (allowedRoles)
  if (rules.allowedRoles && rules.allowedRoles.length > 0) {
    if (!rules.allowedRoles.includes(user.role)) {
      return false;
    }
  }

  // 4. Verticals checks
  if (rules.verticals && rules.verticals.length > 0) {
    if (!rules.verticals.includes("all")) {
      const targetVerticals = rules.verticals.map((v: string) => {
        if (v === "core-tech-uuid-placeholder") return "10000000-0000-0000-0000-000000000002";
        if (v === "exec-uuid-placeholder") return "10000000-0000-0000-0000-000000000001";
        return v;
      });
      if (!targetVerticals.includes(user.verticalId)) {
        return false;
      }
    }
  }

  // 5. Designations checks
  if (rules.designations && rules.designations.length > 0) {
    if (!rules.designations.includes(user.designationId)) {
      return false;
    }
  }

  // 6. Job level checks
  const minJobLevel = rules.minJobLevel !== undefined ? Number(rules.minJobLevel) : 1;
  const userJobLevel = user.designation ? getJobLevelByName(user.designation) : 1;
  if (userJobLevel < minJobLevel) {
    return false;
  }

  return true;
}
