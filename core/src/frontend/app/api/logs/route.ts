import { getSession } from "@backend/auth/sessionManager";
import { type LogSeverity, logEvent } from "@backend/utils/logger";
import { NextResponse } from "next/server";

// In-memory store for rate limiting: IP address -> { count, resetTime }
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export async function POST(request: Request) {
  try {
    const session = await getSession(request as any);
    const userId = session?.id || null;

    // Get client IP address
    const ipAddress =
      request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "127.0.0.1";

    // 1. Rate Limiting Check: Max 5 logs per minute per IP
    const now = Date.now();
    const rateData = rateLimitMap.get(ipAddress);
    if (rateData) {
      if (now < rateData.resetTime) {
        if (rateData.count >= 5) {
          return NextResponse.json(
            { error: "Rate limit exceeded: Max 5 logs per minute" },
            { status: 429 },
          );
        }
        rateData.count++;
      } else {
        // Reset window
        rateLimitMap.set(ipAddress, { count: 1, resetTime: now + 60000 });
      }
    } else {
      rateLimitMap.set(ipAddress, { count: 1, resetTime: now + 60000 });
    }

    // 2. Size Cap: Max 10KB payload
    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > 10 * 1024) {
      return NextResponse.json({ error: "Payload too large (limit: 10KB)" }, { status: 413 });
    }

    const rawText = await request.text();
    if (rawText.length > 10 * 1024) {
      return NextResponse.json({ error: "Payload too large (limit: 10KB)" }, { status: 413 });
    }

    // Parse the request body safely
    let body: any;
    try {
      body = JSON.parse(rawText || "{}");
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
    }

    const { action, severity = "INFO", payload = {} } = body;

    if (!action) {
      return NextResponse.json({ error: "Action is required" }, { status: 400 });
    }

    const validSeverities: LogSeverity[] = ["INFO", "WARN", "ERROR", "CRITICAL"];
    const resolvedSeverity = validSeverities.includes(severity)
      ? (severity as LogSeverity)
      : "INFO";

    await logEvent(userId, action, resolvedSeverity, payload, ipAddress);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Logger API failed:", error.message);
    return NextResponse.json({ error: "Logger error" }, { status: 500 });
  }
}
