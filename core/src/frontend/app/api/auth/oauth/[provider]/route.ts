import { OAUTH_PROVIDERS } from "@backend/auth/oauthProviders";
import { encryptSession } from "@backend/auth/sessionManager";
import { logEvent } from "@backend/utils/logger";
import { db } from "@database/connection";
import { users } from "@database/schema";
import { eq, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params;
  const config = OAUTH_PROVIDERS[provider];

  if (!config) {
    return NextResponse.json(
      { error: `OAuth provider ${provider} not supported` },
      { status: 400 },
    );
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  // Dynamically resolve redirect URI to match the request's origin host and protocol
  const protocol = request.headers.get("x-forwarded-proto") || "http";
  const host = request.headers.get("host") || "localhost:3000";
  const redirectUri = `${protocol}://${host}/api/auth/oauth/${provider}`;

  const ipAddress =
    request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "127.0.0.1";

  // Phase 1: Redirect to provider
  if (!code) {
    // Generate secure state token for CSRF protection
    const secureState = crypto.randomUUID();

    const authUrl = new URL(config.authUrl);
    authUrl.searchParams.set("client_id", config.clientId || "");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", config.scopes.join(" "));
    authUrl.searchParams.set("state", secureState);

    const response = NextResponse.redirect(authUrl.toString());

    // Store state in an HTTP-only cookie
    response.cookies.set("oauth_state", secureState, {
      path: "/",
      maxAge: 300, // 5 minutes
      sameSite: "lax",
      httpOnly: true,
      secure: true,
    });

    return response;
  }

  // Phase 2: Callback Handling
  const savedState = request.cookies.get("oauth_state")?.value;
  if (!state || !savedState || state !== savedState) {
    await logEvent(
      null,
      "OAuth Callback CSRF Validation Failed",
      "WARN",
      { provider, state, savedState },
      ipAddress,
    );
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent("CSRF token validation failed. Please try again.")}`,
        request.url,
      ),
    );
  }

  // Verify client credentials are set
  if (!config.clientId || !config.clientSecret) {
    console.error(`OAuth configuration missing for provider: ${provider}`);
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent("OAuth provider is not configured on the server.")}`,
        request.url,
      ),
    );
  }

  try {
    // Exchange Authorization Code for Access Token
    const bodyParams = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });

    const tokenRes = await fetch(config.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: bodyParams.toString(),
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      throw new Error(`Token exchange failed: ${tokenRes.statusText} - ${errorText}`);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      throw new Error(`Access token not received from ${provider}.`);
    }

    // Retrieve User Profile Info from Provider
    const profile = await config.getProfile(accessToken);

    // Look up user by email in database
    const lowercaseEmail = profile.email.toLowerCase().trim();
    let [user] = await db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${lowercaseEmail}`)
      .limit(1);

    let isNewRegistration = false;

    // Auto-register user if they do not exist
    if (!user) {
      isNewRegistration = true;
      const randomDigits = Math.floor(10000 + Math.random() * 90000);
      const generatedEid = `E_OA_${randomDigits}`;

      const [insertedUser] = await db
        .insert(users)
        .values({
          eid: generatedEid,
          name: profile.name,
          email: lowercaseEmail,
          passwordHash: "OAUTH_USER_NO_PASSWORD",
          isPasswordChanged: true, // Skip password resets for OAuth profiles
          role: "user",
        })
        .returning();

      user = insertedUser;
    }

    // Create session token payload
    const sessionPayload = {
      id: user.id,
      eid: user.eid,
      email: user.email,
      name: user.name,
      role: user.role,
      isPasswordChanged: user.isPasswordChanged,
    };

    const token = await encryptSession(sessionPayload);

    // Create response redirecting to home/dashboard
    const response = NextResponse.redirect(new URL("/", request.url));

    // Set the session cookie
    response.cookies.set("session_token", token, {
      path: "/",
      maxAge: 3600, // 1 hour session
      sameSite: "lax",
      httpOnly: true,
      secure: true,
    });

    // Clear temporary cookies
    response.cookies.delete("oauth_state");

    await logEvent(
      user.id,
      isNewRegistration ? "User Registered via OAuth2" : "User Login via OAuth2",
      "INFO",
      { email: user.email, provider, role: user.role },
      ipAddress,
    );

    return response;
  } catch (error: any) {
    console.error("OAuth execution error for provider:", provider, error);
    await logEvent(
      null,
      "OAuth Flow Exception",
      "ERROR",
      { provider, error: error.message },
      ipAddress,
    );
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(error.message || "Authentication failed.")}`,
        request.url,
      ),
    );
  }
}
