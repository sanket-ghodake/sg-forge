import {
  type AppConfig,
  getMatchedAppsForUser,
  syncAppsToDatabase,
} from "@backend/services/appRegistry";
import { db } from "@database/connection";
import { sql } from "drizzle-orm";

export interface UserSessionPayload {
  user: {
    id: string;
    eid: string;
    name: string;
    email: string;
    role: string;
    designation: string;
    verticalName: string;
    hierarchyLevel: number;
    managerId: string | null;
  };
  manager: {
    id: string;
    eid: string;
    name: string;
    email: string;
    designation: string;
  } | null;
  peers: Array<{
    id: string;
    eid: string;
    name: string;
    email: string;
    designation: string;
    verticalName: string;
  }>;
  directReports: Array<{
    id: string;
    eid: string;
    name: string;
    email: string;
    designation: string;
    verticalName: string;
  }>;
  allUsers: Array<{
    id: string;
    eid: string;
    name: string;
    email: string;
    role: string;
    designation: string;
    verticalName: string;
    managerId: string | null;
  }>;
  allMetadata: Array<{
    id: string;
    type: string;
    name: string;
    parentId: string | null;
    sortOrder: number;
  }>;
  apps: AppConfig[];
}

// Calculate the hierarchy depth by traversing manager chain up to C-suite
export async function getHierarchyLevel(userId: string): Promise<number> {
  const query = sql`
    WITH RECURSIVE manager_chain AS (
      SELECT id, manager_id, 0 as rank_level
      FROM users
      WHERE id = ${userId}
      
      UNION ALL
      
      SELECT u.id, u.manager_id, mc.rank_level + 1
      FROM users u
      INNER JOIN manager_chain mc ON u.id = mc.manager_id
    )
    SELECT COALESCE(MAX(rank_level), 0) as level FROM manager_chain;
  `;

  const result = await db.execute(query);
  const rows = result.rows || result;
  if (rows && rows.length > 0) {
    const levelVal = rows[0].level;
    return levelVal !== null && levelVal !== undefined ? Number(levelVal) : 0;
  }
  return 0;
}

// Core server-side data fetcher for the user workspace
export async function fetchUserDashboardData(userId: string): Promise<UserSessionPayload> {
  // 1. Fetch main user details
  const userResult = await db.execute(sql`
    SELECT 
      u.id, 
      u.eid, 
      u.name, 
      u.email, 
      u.role, 
      u.manager_id as "managerId", 
      u.vertical_id as "verticalId",
      u.designation_id as "designationId",
      dm.name as designation, 
      vm.name as "verticalName"
    FROM users u
    LEFT JOIN structural_metadata dm ON u.designation_id = dm.id
    LEFT JOIN structural_metadata vm ON u.vertical_id = vm.id
    WHERE u.id = ${userId}
  `);

  const userRows = userResult.rows || userResult;
  if (!userRows || userRows.length === 0) {
    throw new Error(`User with ID ${userId} not found.`);
  }

  const rawUser = userRows[0] as any;
  const hierarchyLevel = await getHierarchyLevel(userId);

  const user = {
    id: rawUser.id as string,
    eid: rawUser.eid as string,
    name: rawUser.name as string,
    email: rawUser.email as string,
    role: rawUser.role as string,
    designation: (rawUser.designation as string) || "Staff Member",
    verticalName: (rawUser.verticalName as string) || "Corporate",
    verticalId: (rawUser.verticalId as string) || null,
    designationId: (rawUser.designationId as string) || null,
    managerId: (rawUser.managerId as string) || null,
    hierarchyLevel,
  };

  // 2. Fetch manager details
  let manager = null;
  if (user.managerId) {
    const managerResult = await db.execute(sql`
      SELECT 
        u.id, 
        u.eid, 
        u.name, 
        u.email, 
        dm.name as designation
      FROM users u
      LEFT JOIN structural_metadata dm ON u.designation_id = dm.id
      WHERE u.id = ${user.managerId}
    `);
    const managerRows = managerResult.rows || managerResult;
    if (managerRows && managerRows.length > 0) {
      const rm = managerRows[0] as any;
      manager = {
        id: rm.id as string,
        eid: rm.eid as string,
        name: rm.name as string,
        email: rm.email as string,
        designation: (rm.designation as string) || "Executive",
      };
    }
  }

  // 3. Fetch peers (everyone with same managerId)
  let peers: any[] = [];
  if (user.managerId) {
    const peersResult = await db.execute(sql`
      SELECT 
        u.id, 
        u.eid, 
        u.name, 
        u.email, 
        dm.name as designation,
        vm.name as "verticalName"
      FROM users u
      LEFT JOIN structural_metadata dm ON u.designation_id = dm.id
      LEFT JOIN structural_metadata vm ON u.vertical_id = vm.id
      WHERE u.manager_id = ${user.managerId} AND u.id != ${userId}
      ORDER BY u.name ASC
    `);
    peers = (peersResult.rows || peersResult) as any[];
  }

  // 4. Fetch direct reports (in case user is a manager themselves)
  const reportsResult = await db.execute(sql`
    SELECT 
      u.id, 
      u.eid, 
      u.name, 
      u.email, 
      dm.name as designation,
      vm.name as "verticalName"
    FROM users u
    LEFT JOIN structural_metadata dm ON u.designation_id = dm.id
    LEFT JOIN structural_metadata vm ON u.vertical_id = vm.id
    WHERE u.manager_id = ${userId}
    ORDER BY u.name ASC
  `);
  const directReports = (reportsResult.rows || reportsResult) as any[];

  // 5. Fetch all users for search bar mapping
  const allUsersResult = await db.execute(sql`
    SELECT 
      u.id, 
      u.eid, 
      u.name, 
      u.email, 
      u.role, 
      dm.name as designation, 
      vm.name as "verticalName",
      u.manager_id as "managerId"
    FROM users u
    LEFT JOIN structural_metadata dm ON u.designation_id = dm.id
    LEFT JOIN structural_metadata vm ON u.vertical_id = vm.id
    ORDER BY u.name ASC
  `);
  const allUsers = (allUsersResult.rows || allUsersResult) as any[];

  // 6. Fetch structural metadata
  const metaResult = await db.execute(sql`
    SELECT id, type, name, parent_id as "parentId", sort_order as "sortOrder", extended_attributes as "extendedAttributes"
    FROM structural_metadata
    ORDER BY sort_order ASC
  `);
  const allMetadata = (metaResult.rows || metaResult) as any[];

  // 7. Get discovered applications synced & filtered
  await syncAppsToDatabase();
  const apps = await getMatchedAppsForUser(userId, user);

  return {
    user,
    manager,
    peers: peers.map((p) => ({
      id: p.id as string,
      eid: p.eid as string,
      name: p.name as string,
      email: p.email as string,
      designation: (p.designation as string) || "Staff Member",
      verticalName: (p.verticalName as string) || "Corporate",
    })),
    directReports: directReports.map((r) => ({
      id: r.id as string,
      eid: r.eid as string,
      name: r.name as string,
      email: r.email as string,
      designation: (r.designation as string) || "Staff Member",
      verticalName: (r.verticalName as string) || "Corporate",
    })),
    allUsers: allUsers.map((au) => ({
      id: au.id as string,
      eid: au.eid as string,
      name: au.name as string,
      email: au.email as string,
      role: au.role as string,
      designation: (au.designation as string) || "Staff Member",
      verticalName: (au.verticalName as string) || "Corporate",
      managerId: (au.managerId as string) || null,
    })),
    allMetadata: allMetadata.map((am) => ({
      id: am.id as string,
      type: am.type as string,
      name: am.name as string,
      parentId: (am.parentId as string) || null,
      sortOrder: Number(am.sortOrder),
      extendedAttributes: am.extendedAttributes || {},
    })),
    apps,
  };
}
