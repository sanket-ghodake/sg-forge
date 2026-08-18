// src/backend/middleware/authGuard.ts

import {
  decryptSessionWithExp,
  encryptSession,
  getSession,
  type UserSession,
} from "@backend/auth/sessionManager";
import { NextResponse } from "next/server";

export async function middleware(request: any, event?: any) {
  const path = request.nextUrl.pathname;
  const method = (request.method || "GET").toUpperCase();

  // Bypass authentication checks for OPTIONS preflight requests to allow CORS checks to succeed
  if (method === "OPTIONS") {
    return NextResponse.next();
  }

  // Bypass session checks for isolated app API endpoints (since they authenticate via Bearer token in the child sandbox)
  if (
    (path.startsWith("/forge-apps/") || path.startsWith("/api/forge-apps/")) &&
    path.includes("/api/")
  ) {
    return NextResponse.next();
  }

  // Bypass session checks for Forge Platform APIs (v1) since they use token-based validation
  if (path.startsWith("/api/v1/")) {
    return NextResponse.next();
  }

  // Bypass session checks for portal directory S2S calls (verified in the route handler)
  if (
    path === "/api/directory" &&
    request.headers.get("x-forge-client-id") &&
    request.headers.get("x-forge-client-secret")
  ) {
    return NextResponse.next();
  }

  // 1. Check if the request is for the developer portal
  if (path.startsWith("/developer")) {
    const isFromProxy = request.headers.get("x-from-developer-proxy") === "true";
    if (!isFromProxy) {
      // Redirect direct requests on port 3001 to port 3003
      return NextResponse.redirect(new URL("http://localhost:3003/"));
    }
    return NextResponse.next();
  }

  // 2. Bypass authentication checks for login routes, assets, and app registration APIs
  if (
    path === "/login" ||
    path === "/api/auth/login" ||
    path === "/api/auth/logout" ||
    path === "/api/branding" ||
    path === "/favicon.ico" ||
    path.startsWith("/_next/") ||
    (path === "/api/apps" && method === "GET") ||
    (path === "/api/admin/metadata" && method === "GET")
  ) {
    return NextResponse.next();
  }

  const session = await getSession(request);

  // 2. If no active token exists, block and route back to login
  if (!session) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized session" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 3. Sliding Session Token Auto-Renewal check
  let renewedToken: string | null = null;
  const tokenCookie = request.cookies.get("session_token");
  if (tokenCookie) {
    const sessionData = await decryptSessionWithExp(tokenCookie.value);
    if (sessionData) {
      const { payload, exp } = sessionData;
      const now = Math.floor(Date.now() / 1000);
      const timeRemaining = exp - now;

      // If remaining time is less than 50% (3600 seconds of a 2 hour expiration), renew it
      if (timeRemaining > 0 && timeRemaining < 3600) {
        const freshPayload: UserSession = {
          id: payload.id,
          eid: payload.eid,
          email: payload.email,
          name: payload.name,
          role: payload.role,
          isPasswordChanged: payload.isPasswordChanged,
        };
        renewedToken = await encryptSession(freshPayload);
      }
    }
  }

  // 4. Enforce password reset guard
  let response: NextResponse;
  if (session.isPasswordChanged === false) {
    // Allow access ONLY to force-reset pages/APIs and logs
    const isAllowedResetPath =
      path === "/force-reset" ||
      path === "/api/auth/reset-password" ||
      path === "/api/logs" ||
      path === "/api/auth/session";

    if (!isAllowedResetPath) {
      const isPrefetch =
        request.headers.get("x-middleware-prefetch") === "1" ||
        request.headers.get("purpose") === "prefetch";

      if (!isPrefetch) {
        // Dispatch alert warning log
        const logUrl = new URL("/api/logs", request.url);
        const logPromise = fetch(logUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: request.headers.get("cookie") || "",
          },
          body: JSON.stringify({
            action: "Forced Password Reset Enforced",
            severity: "WARN",
            payload: { email: session.email, interceptedPath: path },
          }),
        }).catch((err) => {
          console.error("Failed to dispatch middleware log:", err);
        });

        if (event && typeof event.waitUntil === "function") {
          event.waitUntil(logPromise);
        }
      }

      if (path.startsWith("/api/")) {
        response = NextResponse.json({ error: "Forced password reset required" }, { status: 403 });
      } else {
        response = NextResponse.redirect(new URL("/force-reset", request.url));
      }
    } else {
      response = NextResponse.next();
    }
  } else {
    // If password is already changed, prevent accessing force-reset page
    if (path === "/force-reset") {
      response = NextResponse.redirect(new URL("/", request.url));
    } else {
      response = NextResponse.next();
    }
  }

  if (renewedToken) {
    response.cookies.set("session_token", renewedToken, {
      path: "/",
      maxAge: 3600,
      sameSite: "lax",
      httpOnly: true,
      secure: true,
    });
  }

  return response;
}
