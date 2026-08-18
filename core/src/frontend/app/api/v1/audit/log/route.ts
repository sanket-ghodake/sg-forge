import { verifyToken } from "@backend/auth/tokenVerifier";
import { db } from "@database/connection";
import { sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    let userId: string;
    let appId: string;
    let scopes: string[];
    try {
      const verified = await verifyToken(authHeader);
      userId = verified.userId;
      appId = verified.appId;
      scopes = verified.scopes;
    } catch (err: any) {
      return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
    }

    if (!scopes.includes("audit.log.write")) {
      return NextResponse.json(
        { error: "Insufficient scopes (audit.log.write required)" },
        { status: 403 },
      );
    }

    // 2. Read request body
    const body = await request.json();
    const { action, severity = "INFO", payload = {} } = body;

    if (!action || typeof action !== "string" || action.trim() === "") {
      return NextResponse.json(
        { error: "Action is required and must be a non-empty string" },
        { status: 400 },
      );
    }

    const validSeverities = ["INFO", "WARN", "ERROR", "CRITICAL"];
    if (!validSeverities.includes(severity)) {
      return NextResponse.json(
        { error: "Invalid severity level. Must be one of INFO, WARN, ERROR, CRITICAL" },
        { status: 400 },
      );
    }

    // 3. Extract IP address
    const ipAddress =
      request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "127.0.0.1";

    // 4. Inject appId into log payload for accountability
    const enrichedPayload = {
      ...payload,
      appId: appId,
    };

    // 5. Insert into system_logs
    const insertResult = await db.execute(sql`
      INSERT INTO system_logs (user_id, action, severity, payload, ip_address)
      VALUES (${userId}, ${action}, ${severity}, ${JSON.stringify(enrichedPayload)}::jsonb, ${ipAddress})
      RETURNING id
    `);
    const insertRows = insertResult.rows || insertResult;
    const logId = insertRows[0].id as string;

    return NextResponse.json({ success: true, logId });
  } catch (error: any) {
    console.error("Audit log API error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
