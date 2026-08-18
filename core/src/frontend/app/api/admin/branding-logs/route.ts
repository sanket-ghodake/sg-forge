import { getSession } from "@backend/auth/sessionManager";
import { db } from "@database/connection";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const session = await getSession(request as any);
    if (!session || session.role !== "super_admin") {
      return NextResponse.json(
        { error: "Unauthorized: Super Admin access required" },
        { status: 403 },
      );
    }

    // Fetch user-wise summary of changes done
    const summaryResult = await db.execute(sql`
      SELECT 
        u.name as "userName",
        u.email as "userEmail",
        COUNT(sl.id)::integer as "changeCount",
        MAX(sl.timestamp) as "lastChangeDate"
      FROM system_logs sl
      JOIN users u ON sl.user_id = u.id
      WHERE sl.action = 'Platform Branding Updated'
      GROUP BY u.id, u.name, u.email
      ORDER BY "changeCount" DESC;
    `);

    // Fetch detailed change log
    const detailsResult = await db.execute(sql`
      SELECT 
        sl.id,
        u.name as "userName",
        u.email as "userEmail",
        sl.ip_address as "ipAddress",
        sl.payload,
        sl.timestamp
      FROM system_logs sl
      JOIN users u ON sl.user_id = u.id
      WHERE sl.action = 'Platform Branding Updated'
      ORDER BY sl.timestamp DESC;
    `);

    return NextResponse.json({
      summary: summaryResult.rows || summaryResult,
      details: detailsResult.rows || detailsResult,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Database error" }, { status: 500 });
  }
}
