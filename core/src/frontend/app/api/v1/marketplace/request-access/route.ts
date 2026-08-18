import { getSession } from "@backend/auth/sessionManager";
import { db } from "@database/connection";
import { sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { appId, reason, scope, targetEntityId } = await request.json();

    if (!appId || !reason) {
      return NextResponse.json({ error: "Missing appId or reason" }, { status: 400 });
    }

    // Check for existing unresolved requests
    const existingRequest = await db.execute(sql`
      SELECT id FROM forge_app_access_requests
      WHERE app_id = ${appId} 
        AND requester_id = ${session.id} 
        AND status IN ('pending_manager', 'pending_app_admin', 'pending_super_admin')
    `);
    const existingRows = existingRequest.rows || existingRequest;
    if (existingRows && existingRows.length > 0) {
      return NextResponse.json(
        { error: "You already have an unresolved access request for this application." },
        { status: 400 },
      );
    }

    // Check if user has a manager
    const userResult = await db.execute(sql`
      SELECT manager_id as "managerId" FROM users WHERE id = ${session.id}
    `);
    const userRows = userResult.rows || userResult;
    const managerId = userRows[0]?.managerId;
    const initialStatus = managerId ? "pending_manager" : "pending_app_admin";

    const targetScope = scope || "individual";

    // Insert access request
    const insertResult = await db.execute(sql`
      INSERT INTO forge_app_access_requests (
        app_id, 
        requester_id, 
        reason, 
        scope, 
        target_entity_id, 
        status
      ) VALUES (
        ${appId}, 
        ${session.id}, 
        ${reason}, 
        ${targetScope}, 
        ${targetEntityId || null}, 
        ${initialStatus}
      ) RETURNING id
    `);

    const rows = (insertResult.rows || insertResult) as any[];
    const requestId = rows[0]?.id;

    // Create the initial timeline/discussion message thread entry
    const initMessage = `📣 Request submitted by ${session.name} with scope: ${targetScope}. Justification: "${reason}"`;
    await db.execute(sql`
      INSERT INTO forge_app_access_request_messages (request_id, sender_id, message)
      VALUES (${requestId}, ${session.id}, ${initMessage})
    `);

    return NextResponse.json({ success: true, requestId });
  } catch (error: any) {
    console.error("Request access API error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
