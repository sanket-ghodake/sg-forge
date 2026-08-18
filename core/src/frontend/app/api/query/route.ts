import { executeAdminQuery } from "@backend/api/admin/queryEngine";
import { getSession } from "@backend/auth/sessionManager";
import { logEvent } from "@backend/utils/logger";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const ipAddress =
    request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "127.0.0.1";

  // Check user session
  const session = await getSession(request as any);
  if (!session) {
    await logEvent(null, "SQL Query Unauthorized Attempt", "WARN", {}, ipAddress);
    return NextResponse.json({ error: "Unauthorized: Session missing" }, { status: 401 });
  }

  let queryText = "";
  try {
    const { query } = await request.json();
    queryText = query || "";
    if (!queryText) {
      return NextResponse.json({ error: "Query cannot be empty" }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
  }

  // Enforce role gating: only administrative roles can run raw queries
  const allowedRoles = ["super_admin", "admin", "read_only_admin"];
  if (!allowedRoles.includes(session.role)) {
    await logEvent(
      session.id,
      "SQL Query Forbidden Attempt",
      "WARN",
      { role: session.role, query: queryText },
      ipAddress,
    );
    return NextResponse.json(
      { error: "Forbidden: Access denied. Only administrative roles can execute raw SQL queries." },
      { status: 403 },
    );
  }

  try {
    // Execute the query using our query sandbox
    const result = await executeAdminQuery(queryText, session.role);

    // Log successful query execution
    await logEvent(
      session.id,
      "SQL Query Executed",
      "INFO",
      { query: queryText, role: session.role },
      ipAddress,
    );

    // Express returns rows in the result property
    return NextResponse.json({
      rows: result.rows || result,
      rowCount: result.rowCount ?? (Array.isArray(result) ? result.length : 0),
      fields: result.fields ? result.fields.map((f: any) => f.name) : [],
    });
  } catch (error: any) {
    console.error("SQL Execution failed:", error.message);

    // Log failed query execution
    await logEvent(
      session.id,
      "SQL Query Failed",
      "ERROR",
      { query: queryText, error: error.message },
      ipAddress,
    );

    return NextResponse.json({ error: error.message || "Database error" }, { status: 500 });
  }
}
