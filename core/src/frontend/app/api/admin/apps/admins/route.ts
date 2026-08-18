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

    // 1. Resolve App ID
    const appResult = await db.execute(sql`
      SELECT id FROM forge_apps WHERE id = ${appId} OR slug = ${appId}
    `);
    const appRows = appResult.rows || appResult;
    if (!appRows || appRows.length === 0) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }
    const resolvedAppId = appRows[0].id as string;

    // 2. Fetch currently assigned admins for this app
    const assignedAdminsResult = await db.execute(sql`
      SELECT u.id, u.name, u.email, u.role, u.eid
      FROM forge_app_admins fa
      INNER JOIN users u ON fa.user_id = u.id
      WHERE fa.app_id = ${resolvedAppId}
      ORDER BY u.name ASC
    `);
    const assignedAdmins = assignedAdminsResult.rows || assignedAdminsResult;

    // 3. Fetch all admins in the system to select from
    const allAdminsResult = await db.execute(sql`
      SELECT id, name, email, role, eid
      FROM users
      WHERE role IN ('admin', 'super_admin')
      ORDER BY name ASC
    `);
    const allAdmins = allAdminsResult.rows || allAdminsResult;

    return NextResponse.json({
      success: true,
      assignedAdmins,
      allAdmins,
    });
  } catch (error: any) {
    console.error("Fetch app admins mapping error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    // ONLY Super Admins can delegate app management permissions to other admins
    if (!session || session.role !== "super_admin") {
      return NextResponse.json(
        { error: "Forbidden: Only Super Admins can configure App Management delegation" },
        { status: 403 },
      );
    }

    const { appId, userId, action } = await request.json();

    if (!appId || !userId || !action) {
      return NextResponse.json(
        { error: "Missing parameters: appId, userId, or action" },
        { status: 400 },
      );
    }

    // 1. Resolve App ID
    const appResult = await db.execute(sql`
      SELECT id FROM forge_apps WHERE id = ${appId} OR slug = ${appId}
    `);
    const appRows = appResult.rows || appResult;
    if (!appRows || appRows.length === 0) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }
    const resolvedAppId = appRows[0].id as string;

    if (action === "add") {
      // Check if already assigned
      const checkRes = await db.execute(sql`
        SELECT 1 FROM forge_app_admins WHERE app_id = ${resolvedAppId} AND user_id = ${userId}
      `);
      const checkRows = checkRes.rows || checkRes;
      if (!checkRows || checkRows.length === 0) {
        await db.execute(sql`
          INSERT INTO forge_app_admins (app_id, user_id)
          VALUES (${resolvedAppId}, ${userId})
        `);
      }
    } else if (action === "remove") {
      await db.execute(sql`
        DELETE FROM forge_app_admins WHERE app_id = ${resolvedAppId} AND user_id = ${userId}
      `);
    } else {
      return NextResponse.json({ error: "Invalid action parameter" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Configure app admin assignment error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
