import { encryptSession, getSession } from "@backend/auth/sessionManager";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ authenticated: false, isElevated: false });
  }

  const isElevated = (session as any).sudoUntil ? (session as any).sudoUntil > Date.now() : false;
  const expiresInSeconds = isElevated
    ? Math.ceil(((session as any).sudoUntil - Date.now()) / 1000)
    : 0;

  return NextResponse.json({
    authenticated: true,
    isElevated,
    expiresInSeconds,
    role: session.role,
  });
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { action, code } = body;

    // Handle de-elevation
    if (action === "demote") {
      const updatedSession = { ...session };
      delete (updatedSession as any).sudoUntil;

      const response = NextResponse.json({ success: true, isElevated: false });
      const encrypted = await encryptSession(updatedSession);
      response.cookies.set("session_token", encrypted, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
      });
      return response;
    }

    // Check if user is admin or super_admin to allow elevation
    if (session.role !== "admin" && session.role !== "super_admin") {
      return NextResponse.json(
        { error: "Forbidden: Admin role required for elevation" },
        { status: 403 },
      );
    }

    // Verify mock MFA / Totp code
    const isDevOrTest =
      process.env.NODE_ENV === "development" ||
      process.env.NODE_ENV === "test" ||
      !process.env.NODE_ENV;
    if (!isDevOrTest) {
      return NextResponse.json(
        { error: "Production MFA validation engine is not configured." },
        { status: 501 },
      );
    }

    if (code !== "123456" && code !== "000000") {
      return NextResponse.json(
        { error: "Invalid MFA Passkey or Totp Code. Use 123456." },
        { status: 400 },
      );
    }

    const sudoUntil = Date.now() + 15 * 60 * 1000; // 15 minutes
    const updatedSession = {
      ...session,
      sudoUntil,
    };

    const response = NextResponse.json({
      success: true,
      isElevated: true,
      expiresAt: sudoUntil,
    });

    const encrypted = await encryptSession(updatedSession);
    response.cookies.set("session_token", encrypted, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });

    // Write audit log entry
    try {
      const logUrl = new URL("/api/logs", request.url);
      await fetch(logUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: request.headers.get("cookie") || "",
        },
        body: JSON.stringify({
          action: "Sudo Elevation Activated",
          severity: "INFO",
          payload: { email: session.email, scope: "Global Admin", durationMinutes: 15 },
        }),
      });
    } catch (logErr) {
      console.error("Failed to log sudo elevation:", logErr);
    }

    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
