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
    const requestId = searchParams.get("requestId");

    if (!requestId) {
      return NextResponse.json({ error: "Missing requestId parameter" }, { status: 400 });
    }

    // Fetch the request to verify access
    const requestResult = await db.execute(sql`
      SELECT 
        r.id, 
        r.app_id as "appId", 
        r.requester_id as "requesterId", 
        u.manager_id as "managerId",
        r.status
      FROM forge_app_access_requests r
      INNER JOIN users u ON r.requester_id = u.id
      WHERE r.id = ${requestId}
    `);
    const requestRows = (requestResult.rows || requestResult) as any[];
    if (!requestRows || requestRows.length === 0) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }
    const accessRequest = requestRows[0];

    // Authorization check: User, requester's manager, app admin, or super admin
    const isRequester = session.id === accessRequest.requesterId;
    const isManager = session.id === accessRequest.managerId;
    const isSuperAdmin = session.role === "super_admin";

    const appAdminRes = await db.execute(sql`
      SELECT 1 FROM forge_app_admins WHERE app_id = ${accessRequest.appId} AND user_id = ${session.id}
    `);
    const appAdminRows = (appAdminRes.rows || appAdminRes) as any[];
    const isAppAdmin = appAdminRows && appAdminRows.length > 0;

    if (!isRequester && !isManager && !isSuperAdmin && !isAppAdmin) {
      return NextResponse.json(
        { error: "Forbidden: You do not have access to this request" },
        { status: 403 },
      );
    }

    // Fetch messages
    const messagesResult = await db.execute(sql`
      SELECT 
        m.id, 
        m.request_id as "requestId", 
        m.sender_id as "senderId", 
        u.name as "senderName", 
        CASE 
          WHEN u.role = 'super_admin' THEN 'super_admin'
          WHEN EXISTS (SELECT 1 FROM forge_app_admins WHERE app_id = r.app_id AND user_id = m.sender_id) THEN 'app_admin'
          WHEN m.sender_id = r.manager_reviewed_by OR m.sender_id = u2.manager_id THEN 'manager'
          ELSE 'user'
        END as "senderRole",
        m.message, 
        m.created_at as "createdAt"
      FROM forge_app_access_request_messages m
      INNER JOIN users u ON m.sender_id = u.id
      INNER JOIN forge_app_access_requests r ON m.request_id = r.id
      INNER JOIN users u2 ON r.requester_id = u2.id
      WHERE m.request_id = ${requestId}
      ORDER BY m.created_at ASC
    `);
    const messages = messagesResult.rows || messagesResult;

    return NextResponse.json({ messages });
  } catch (error: any) {
    console.error("Fetch request messages error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { requestId, message } = await request.json();

    if (!requestId || !message || !message.trim()) {
      return NextResponse.json({ error: "Missing requestId or message" }, { status: 400 });
    }

    // Fetch request to verify access
    const requestResult = await db.execute(sql`
      SELECT 
        r.id, 
        r.app_id as "appId", 
        r.requester_id as "requesterId", 
        u.manager_id as "managerId",
        r.status
      FROM forge_app_access_requests r
      INNER JOIN users u ON r.requester_id = u.id
      WHERE r.id = ${requestId}
    `);
    const requestRows = (requestResult.rows || requestResult) as any[];
    if (!requestRows || requestRows.length === 0) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }
    const accessRequest = requestRows[0];

    // Authorization check
    const isRequester = session.id === accessRequest.requesterId;
    const isManager = session.id === accessRequest.managerId;
    const isSuperAdmin = session.role === "super_admin";

    const appAdminRes = await db.execute(sql`
      SELECT 1 FROM forge_app_admins WHERE app_id = ${accessRequest.appId} AND user_id = ${session.id}
    `);
    const appAdminRows = (appAdminRes.rows || appAdminRes) as any[];
    const isAppAdmin = appAdminRows && appAdminRows.length > 0;

    if (!isRequester && !isManager && !isSuperAdmin && !isAppAdmin) {
      return NextResponse.json(
        { error: "Forbidden: You do not have access to this request" },
        { status: 403 },
      );
    }

    // Insert message
    const insertResult = await db.execute(sql`
      INSERT INTO forge_app_access_request_messages (request_id, sender_id, message)
      VALUES (${requestId}, ${session.id}, ${message.trim()})
      RETURNING id
    `);
    const insertedRows = (insertResult.rows || insertResult) as any[];
    const messageId = insertedRows[0].id;

    // Fetch the detailed message with the CASE statement context
    const msgResult = await db.execute(sql`
      SELECT 
        m.id, 
        m.request_id as "requestId", 
        m.sender_id as "senderId", 
        u.name as "senderName", 
        CASE 
          WHEN u.role = 'super_admin' THEN 'super_admin'
          WHEN EXISTS (SELECT 1 FROM forge_app_admins WHERE app_id = r.app_id AND user_id = m.sender_id) THEN 'app_admin'
          WHEN m.sender_id = r.manager_reviewed_by OR m.sender_id = u2.manager_id THEN 'manager'
          ELSE 'user'
        END as "senderRole",
        m.message, 
        m.created_at as "createdAt"
      FROM forge_app_access_request_messages m
      INNER JOIN users u ON m.sender_id = u.id
      INNER JOIN forge_app_access_requests r ON m.request_id = r.id
      INNER JOIN users u2 ON r.requester_id = u2.id
      WHERE m.id = ${messageId}
    `);
    const newMessage = ((msgResult.rows || msgResult) as any[])[0];

    return NextResponse.json({ success: true, message: newMessage });
  } catch (error: any) {
    console.error("Create request message error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
