import { getSession } from "@backend/auth/sessionManager";
import { verifyToken } from "@backend/auth/tokenVerifier";
import { decryptText } from "@backend/utils/crypto";
import { roDb } from "@database/connection";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    let isAuthorized = false;
    let isS2S = false;
    let userRole = "user";

    // 1. Check for Service-to-Service headers
    const clientIdHeader = request.headers.get("x-forge-client-id");
    const clientSecretHeader = request.headers.get("x-forge-client-secret");
    if (clientIdHeader && clientSecretHeader) {
      const appResult = await roDb.execute(sql`
        SELECT client_secret as "clientSecret" FROM forge_apps WHERE client_id = ${clientIdHeader}
      `);
      const appRows = (appResult.rows || appResult) as any[];
      if (appRows && appRows.length > 0) {
        try {
          const decrypted = decryptText(appRows[0].clientSecret as string);
          if (decrypted === clientSecretHeader) {
            isAuthorized = true;
            isS2S = true;
          }
        } catch (err) {
          // Ignore
        }
      }
    }

    // 2. Check for standard Authorization Bearer token
    if (!isAuthorized) {
      const authHeader = request.headers.get("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        try {
          const verified = await verifyToken(authHeader);
          isAuthorized = true;
          const userResult = await roDb.execute(sql`
            SELECT role FROM users WHERE id = ${verified.userId}
          `);
          const userRows = (userResult.rows || userResult) as any[];
          if (userRows && userRows.length > 0) {
            userRole = userRows[0].role || "user";
          }
        } catch (err) {
          // Ignore
        }
      }
    }

    // 3. Fallback to browser session cookie
    if (!isAuthorized) {
      const session = await getSession(request as any);
      if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      isAuthorized = true;
      userRole = session.role || "user";
    }

    const { searchParams } = new URL(request.url);
    const checkManagerId = searchParams.get("checkManagerId");
    const checkEmployeeId = searchParams.get("checkEmployeeId");

    if (checkManagerId && checkEmployeeId) {
      const hierarchyResult = await roDb.execute(sql`
        WITH RECURSIVE manager_chain AS (
          SELECT id, manager_id FROM users WHERE id = ${checkEmployeeId}
          UNION ALL
          SELECT u.id, u.manager_id
          FROM users u
          JOIN manager_chain mc ON mc.manager_id = u.id
        )
        SELECT 1 FROM manager_chain WHERE manager_id = ${checkManagerId} LIMIT 1
      `);
      const rows = hierarchyResult.rows || hierarchyResult;
      const isUpline = rows && rows.length > 0;
      return NextResponse.json({ isUpline });
    }

    const q = searchParams.get("q") || "";
    const managerId = searchParams.get("managerId") || "";

    const isEmployee = !isS2S && !["super_admin", "admin", "read_only_admin"].includes(userRole);

    let usersQuery = sql`
      SELECT u.id, u.eid, u.name, u.email, u.role, u.designation_id as "designationId", u.vertical_id as "verticalId", u.manager_id as "managerId", dm.name as designation
      FROM users u
      LEFT JOIN structural_metadata dm ON u.designation_id = dm.id
      ORDER BY u.name ASC
    `;
    if (isEmployee && !q && !managerId) {
      usersQuery = sql`
        SELECT u.id, u.eid, u.name, u.email, u.role, u.designation_id as "designationId", u.vertical_id as "verticalId", u.manager_id as "managerId", dm.name as designation
        FROM users u
        LEFT JOIN structural_metadata dm ON u.designation_id = dm.id
        ORDER BY u.name ASC
        LIMIT 50
      `;
    }
    let isFiltered = false;

    if (q) {
      isFiltered = true;
      const searchPattern = `%${q.trim()}%`;
      usersQuery = sql`
        SELECT u.id, u.eid, u.name, u.email, u.role, u.designation_id as "designationId", u.vertical_id as "verticalId", u.manager_id as "managerId", dm.name as designation
        FROM users u
        LEFT JOIN structural_metadata dm ON u.designation_id = dm.id
        WHERE u.name ILIKE ${searchPattern} OR u.email ILIKE ${searchPattern} OR u.eid ILIKE ${searchPattern} OR dm.name ILIKE ${searchPattern}
        ORDER BY u.name ASC
        LIMIT 50
      `;
    } else if (managerId) {
      isFiltered = true;
      if (managerId === "root") {
        usersQuery = sql`
          SELECT u.id, u.eid, u.name, u.email, u.role, u.designation_id as "designationId", u.vertical_id as "verticalId", u.manager_id as "managerId", dm.name as designation
          FROM users u
          LEFT JOIN structural_metadata dm ON u.designation_id = dm.id
          WHERE u.manager_id IS NULL
          ORDER BY u.name ASC
        `;
      } else {
        usersQuery = sql`
          SELECT u.id, u.eid, u.name, u.email, u.role, u.designation_id as "designationId", u.vertical_id as "verticalId", u.manager_id as "managerId", dm.name as designation
          FROM users u
          LEFT JOIN structural_metadata dm ON u.designation_id = dm.id
          WHERE u.manager_id = ${managerId}
          ORDER BY u.name ASC
        `;
      }
    }

    // Fetch filtered/unfiltered users using read-only DB pool
    const usersResult = await roDb.execute(usersQuery);
    const users = usersResult.rows || usersResult;

    // Fetch structural metadata only if not filtering, to optimize bandwidth
    let metadata: any[] = [];
    if (!isFiltered) {
      const metaResult = await roDb.execute(sql`
        SELECT id, type, name, parent_id, sort_order
        FROM structural_metadata
        ORDER BY type, name ASC
      `);
      metadata = (metaResult.rows || metaResult) as any[];
    }

    return NextResponse.json({ users, metadata });
  } catch (error: any) {
    console.error("Directory API error:", error);
    return NextResponse.json({ error: error.message || "Database error" }, { status: 500 });
  }
}
