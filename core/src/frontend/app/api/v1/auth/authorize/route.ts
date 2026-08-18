import { hasAppAccess } from "@backend/auth/permissionEngine";
import { getSession } from "@backend/auth/sessionManager";
import { db } from "@database/connection";
import crypto from "crypto";
import { sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("client_id") || searchParams.get("clientId");
    const redirectUri = searchParams.get("redirect_uri") || searchParams.get("redirectUri");
    const state = searchParams.get("state");
    const responseType = searchParams.get("response_type") || searchParams.get("responseType");

    // 1. Parameter Validation
    if (!clientId || !redirectUri || !state || responseType !== "code") {
      return NextResponse.json(
        { error: "Invalid or missing authorization request parameters" },
        { status: 400 },
      );
    }

    // 2. Resolve Portal Session
    const session = await getSession(request);

    // Check if it is a direct login from the app's website directly
    const isDirectLogin = state === "direct_login";
    const prompt = searchParams.get("prompt");

    if (isDirectLogin && prompt !== "none" && prompt !== "verified") {
      // Force re-authentication by redirecting to portal login
      const loginUrl = new URL("/login", request.url);
      const redirectBackUrl = new URL(request.url);
      redirectBackUrl.searchParams.set("prompt", "none"); // Set prompt=none to prevent redirect loop
      loginUrl.searchParams.set("redirect_back", redirectBackUrl.toString());
      return NextResponse.redirect(loginUrl.toString());
    }

    if (!session) {
      // User is not logged in. Redirect to portal login and pass the current URL as redirect_back
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect_back", request.url);
      return NextResponse.redirect(loginUrl.toString());
    }

    // 3. Retrieve Forge App Configuration
    const appResult = await db.execute(sql`
      SELECT id, slug, name, is_enabled as "isEnabled", redirect_uri as "redirectUri", scopes 
      FROM forge_apps 
      WHERE client_id = ${clientId}
    `);
    const appRows = appResult.rows || appResult;
    if (!appRows || appRows.length === 0) {
      return NextResponse.json({ error: "Application not registered" }, { status: 404 });
    }
    const app = appRows[0] as any;

    if (!app.isEnabled) {
      return NextResponse.json({ error: "Application is disabled" }, { status: 403 });
    }

    // 4. Validate Redirect URI
    // To support local development/sandbox hostnames seamlessly, we allow matches based on pathname
    // and standard hostnames for the forge applications
    const isRedirectUriAllowed = (configured: string, requested: string): boolean => {
      try {
        const conf = new URL(configured);
        const req = new URL(requested);
        const pathsMatch =
          req.pathname === "/callback" || req.pathname === conf.pathname || req.pathname === "/";
        if (!pathsMatch) return false;

        const reqHostClean = req.hostname;
        // Allow localhost, 127.0.0.1, or app's slug as a hostname for local developer ease
        const isLocalHost =
          reqHostClean === "localhost" || reqHostClean === "127.0.0.1" || reqHostClean === app.slug;
        if (isLocalHost) {
          return true;
        }

        const allowedHosts = [
          conf.host,
          "localhost:8090",
          "127.0.0.1:8090",
          "example-forge-app:8090",
          "localhost:8080",
          "reference-expenses:8080",
          "localhost:8000",
          "reference-python:8000",
          "localhost:8081",
          "reference-go:8081",
        ];
        return allowedHosts.includes(req.host);
      } catch {
        return configured === requested;
      }
    };

    if (!isRedirectUriAllowed(app.redirectUri || app.entryUrl || "", redirectUri)) {
      return NextResponse.json({ error: "Unauthorized redirect_uri parameter" }, { status: 400 });
    }

    // 5. Verify App Entitlements (Permission Matrix Validation)
    const accessAllowed = await hasAppAccess(session.id, app.id);
    if (!accessAllowed) {
      // Redirect to portal home with an access denied query param to show a toast/alert
      const deniedUrl = new URL("/", request.url);
      deniedUrl.searchParams.set("error", "app_access_denied");
      deniedUrl.searchParams.set("appName", app.name);
      return NextResponse.redirect(deniedUrl.toString());
    }

    // 6. Generate Authorization Code
    const code = "auth_code_" + crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 1000); // 30 seconds expiration time

    await db.execute(sql`
      INSERT INTO forge_auth_codes (code, app_id, user_id, expires_at, scope, used)
      VALUES (${code}, ${app.id}, ${session.id}, ${expiresAt.toISOString()}, ${JSON.stringify(app.scopes || [])}::jsonb, false)
    `);

    // 7. Redirect back to Child Application callback
    const redirectUrl = new URL(redirectUri);
    redirectUrl.searchParams.set("code", code);
    redirectUrl.searchParams.set("state", state);

    return NextResponse.redirect(redirectUrl.toString());
  } catch (error: any) {
    console.error("SSO Authorize endpoint error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error during SSO authorization" },
      { status: 500 },
    );
  }
}
