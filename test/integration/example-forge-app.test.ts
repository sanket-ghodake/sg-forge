import { beforeAll, describe, expect, test } from "bun:test";
import { encryptSession } from "@backend/auth/sessionManager";
import { decryptText } from "@backend/utils/crypto";
import { db } from "@database/connection";
import { POST as adminAppsPostHandler } from "@frontend/app/api/admin/apps/route";
// Import API route handlers for integration testing
import { POST as handshakeHandler } from "@frontend/app/api/apps/handshake/route";
import { GET as authorizeHandler } from "@frontend/app/api/v1/auth/authorize/route";
import { POST as exchangeHandler } from "@frontend/app/api/v1/auth/exchange/route";
import { GET as userHandler } from "@frontend/app/api/v1/user/route";
import crypto from "crypto";
import { sql } from "drizzle-orm";

function mockRequest(options: {
  method: string;
  url: string;
  body?: any;
  cookies?: Record<string, string>;
  headers?: Record<string, string>;
}) {
  const normalizedHeaders: Record<string, string> = {};
  if (options.headers) {
    for (const [key, val] of Object.entries(options.headers)) {
      normalizedHeaders[key.toLowerCase()] = val;
    }
  }
  return {
    method: options.method,
    url: options.url,
    headers: {
      get: (name: string) => normalizedHeaders[name.toLowerCase()] || null,
    },
    cookies: {
      get: (name: string) => {
        const val = options.cookies?.[name];
        return val ? { name, value: val } : null;
      },
    },
    json: async () => options.body || {},
  } as any;
}

describe("SG Forge Example App Integration Tests", () => {
  let adminSessionToken: string;
  let devSessionToken: string;
  let devName: string;
  const appSlug = "example-forge-app";

  beforeAll(async () => {
    // Resolve test admin user (super_admin E0001)
    const adminRes = await db.execute(sql`SELECT id, role FROM users WHERE eid = 'E0001'`);
    const admin = (adminRes.rows || adminRes)[0];
    adminSessionToken = await encryptSession({
      id: admin.id,
      eid: "E0001",
      email: "ceo@sgforge.com",
      name: "Arthur Pendragon",
      role: admin.role,
      isPasswordChanged: true,
    });

    // Resolve regular user (Diana Prince E0007 / Sai)
    const devRes = await db.execute(sql`SELECT id, name, role FROM users WHERE eid = 'E0007'`);
    const dev = (devRes.rows || devRes)[0];
    devName = dev.name;
    devSessionToken = await encryptSession({
      id: dev.id,
      eid: "E0007",
      email: "diana@sgforge.com",
      name: dev.name,
      role: dev.role,
      isPasswordChanged: true,
    });
  });

  test("1. Scan & Sync Manifests: Discover and Register example-forge-app", async () => {
    const req = mockRequest({
      method: "POST",
      url: "http://localhost/api/admin/apps",
      cookies: { session_token: adminSessionToken },
      body: { action: "scan" },
    });

    const response = await adminAppsPostHandler(req);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);

    // Verify registration details in Postgres
    const appRes = await db.execute(sql`
      SELECT entry_url, client_id as "clientId", client_secret as "clientSecret", is_enabled 
      FROM forge_apps 
      WHERE slug = ${appSlug}
    `);
    const app = (appRes.rows || appRes)[0];
    expect(app).toBeDefined();
    expect(app.is_enabled).toBe(true);
    expect(app.entry_url).toBe("http://example-forge-app:8090/");
    expect(app.clientId).toBe("client_example_forge_app");
    expect(decryptText(app.clientSecret)).toBe("secret_example_forge_app");
  });

  test("2. Secure OAuth Code Generation (Handshake)", async () => {
    const req = mockRequest({
      method: "POST",
      url: "http://localhost/api/apps/handshake",
      cookies: { session_token: devSessionToken },
      body: { slug: appSlug },
    });

    const response = await handshakeHandler(req);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.code).toBeDefined();
    expect(body.code.startsWith("auth_code_")).toBe(true);
  });

  test("3. Token Exchange and User Directory Scope Authentication", async () => {
    // 1. Generate new auth code for dev session
    const handshakeReq = mockRequest({
      method: "POST",
      url: "http://localhost/api/apps/handshake",
      cookies: { session_token: devSessionToken },
      body: { slug: appSlug },
    });
    const handshakeRes = await handshakeHandler(handshakeReq);
    const code = (await handshakeRes.json()).code;

    // 2. Request token exchange using application credentials
    const exchangeReq = mockRequest({
      method: "POST",
      url: "http://localhost/api/v1/auth/exchange",
      body: {
        code,
        client_id: "client_example_forge_app",
        client_secret: "secret_example_forge_app",
      },
    });

    const exchangeRes = await exchangeHandler(exchangeReq);
    expect(exchangeRes.status).toBe(200);
    const exchangeBody = await exchangeRes.json();
    expect(exchangeBody.access_token).toBeDefined();
    expect(exchangeBody.user.eid).toBe("E0007");
    expect(exchangeBody.scopes).toContain("user.profile.read");

    // 3. Verify user retrieval endpoint works with access token
    const userReq = mockRequest({
      method: "GET",
      url: "http://localhost/api/v1/user",
      headers: { Authorization: `Bearer ${exchangeBody.access_token}` },
    });
    const userRes = await userHandler(userReq);
    expect(userRes.status).toBe(200);
    const userBody = await userRes.json();
    expect(userBody.user.eid).toBe("E0007");
    expect(userBody.user.name).toBe(devName);
  });

  test("4. SSO Authorize Endpoint: Redirect to Login when Unauthenticated", async () => {
    const req = mockRequest({
      method: "GET",
      url: "http://localhost/api/v1/auth/authorize?client_id=client_example_forge_app&redirect_uri=http://localhost:8090/callback&state=sso_test_state&response_type=code",
    });
    const response = await authorizeHandler(req);
    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toContain("/login");
    expect(location).toContain("redirect_back");
  });

  test("5. SSO Authorize Endpoint: Redirect with code when Authenticated & Entitled", async () => {
    const req = mockRequest({
      method: "GET",
      url: "http://localhost/api/v1/auth/authorize?client_id=client_example_forge_app&redirect_uri=http://localhost:8090/callback&state=sso_test_state&response_type=code",
      cookies: { session_token: devSessionToken },
    });
    const response = await authorizeHandler(req);
    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toContain("http://localhost:8090/callback");
    expect(location).toContain("code=auth_code_");
    expect(location).toContain("state=sso_test_state");
  });
});
