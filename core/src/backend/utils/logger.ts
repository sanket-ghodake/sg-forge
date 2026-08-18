import { db } from "@database/connection";
import { systemLogs } from "@database/schema";

export type LogSeverity = "INFO" | "WARN" | "ERROR" | "CRITICAL";

export async function logEvent(
  userId: string | null,
  action: string,
  severity: LogSeverity,
  payload: Record<string, any> = {},
  ipAddress: string | null = null,
) {
  const timestamp = new Date();

  // Always log to console first for operational visibility
  const consoleMsg = `[${timestamp.toISOString()}] [${severity}] ${action} ${
    userId ? `(User: ${userId})` : "(Anonymous)"
  } ${ipAddress ? `[IP: ${ipAddress}]` : ""} - Payload: ${JSON.stringify(payload)}`;

  if (severity === "ERROR" || severity === "CRITICAL") {
    console.error(consoleMsg);
  } else if (severity === "WARN") {
    console.warn(consoleMsg);
  } else {
    console.log(consoleMsg);
  }

  try {
    // Insert into PostgreSQL database via Drizzle ORM
    await db.insert(systemLogs).values({
      userId: userId || null,
      action,
      severity,
      payload,
      ipAddress,
    });
  } catch (dbError: any) {
    console.error(`[FATAL] Failed to write log event to database: ${dbError.message}`);
  }
}
