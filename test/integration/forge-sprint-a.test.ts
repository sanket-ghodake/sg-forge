import { beforeAll, describe, expect, test } from "bun:test";
import { syncAppsToDatabase } from "@backend/api/user/portal";
import {
  checkPermission,
  resolveAppPermissions,
  resolveUserPermissions,
} from "@backend/auth/permissionEngine";
import { encryptSession } from "@backend/auth/sessionManager";
import { decryptText } from "@backend/utils/crypto";
import { db } from "@database/connection";
// Import Route Handlers to perform real pipeline logic testing
import { POST as handshakeHandler } from "@frontend/app/api/apps/handshake/route";
import { POST as auditLogHandler } from "@frontend/app/api/v1/audit/log/route";
import { POST as exchangeHandler } from "@frontend/app/api/v1/auth/exchange/route";
import { GET as permissionsHandler } from "@frontend/app/api/v1/permissions/route";
import { GET as userHandler } from "@frontend/app/api/v1/user/route";
import crypto from "crypto";
import { sql } from "drizzle-orm";

// Helper function to mock NextRequest interface for local handler execution
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

describe("SG Forge Sprint A Integration Tests", () => {
  beforeAll(async () => {
    // Sync app registry
    await syncAppsToDatabase();
  });

  test("1. App Manifest v2 should synchronize and generate clientId/clientSecret", async () => {
    const appsResult = await db.execute(sql`
      SELECT slug, client_id as "clientId", client_secret as "clientSecret", scopes, redirect_uri as "redirectUri"
      FROM forge_apps
    `);
    const apps = appsResult.rows || appsResult;
    expect(apps.length).toBeGreaterThan(0);

    for (const app of apps) {
      expect(app.clientId).toBeDefined();
      expect(app.clientSecret).toBeDefined();
      expect(app.clientId.startsWith("client_")).toBe(true);
      expect(decryptText(app.clientSecret).startsWith("secret_")).toBe(true);
    }
  });

  test("2. Permission Engine resolves hierarchical roles via recursive CTE", async () => {
    // CEO ID is E0001 (super_admin)
    const ceoResult = await db.execute(sql`SELECT id FROM users WHERE eid = 'E0001'`);
    const ceo = (ceoResult.rows || ceoResult)[0];
    const ceoPerms = await resolveUserPermissions(ceo.id);
    expect(ceoPerms).toContain("user.profile.read");
    expect(ceoPerms).toContain("user.manager.read");
    expect(ceoPerms).toContain("audit.log.write");

    // Software Engineer is E0007 (user)
    const devResult = await db.execute(sql`SELECT id FROM users WHERE eid = 'E0007'`);
    const dev = (devResult.rows || devResult)[0];
    const devPerms = await resolveUserPermissions(dev.id);
    expect(devPerms).toContain("user.profile.read");
    expect(devPerms).toContain("user.manager.read");
    expect(devPerms).not.toContain("audit.log.write"); // does not inherit audit write permission
  });

  test("3. Handshake Route - Code Generation & Cookie Verification", async () => {
    // Fetch user and app info
    const devResult = await db.execute(sql`SELECT id, role FROM users WHERE eid = 'E0007'`);
    const dev = (devResult.rows || devResult)[0];
    const appResult = await db.execute(
      sql`SELECT slug FROM forge_apps WHERE slug = 'apex-expenses' LIMIT 1`,
    );
    const app = (appResult.rows || appResult)[0];

    // Encrypt real session cookie
    const sessionToken = await encryptSession({
      id: dev.id,
      eid: "E0007",
      email: "diana@sgforge.com",
      name: "Diana Prince",
      role: dev.role,
      isPasswordChanged: true,
    });

    // Run handshake handler
    const req = mockRequest({
      method: "POST",
      url: "http://localhost/api/apps/handshake",
      body: { slug: app.slug },
      cookies: { session_token: sessionToken },
    });

    const response = await handshakeHandler(req);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.code).toBeDefined();
    expect(body.code.startsWith("auth_code_")).toBe(true);
  });

  test("4. Auth Exchange Route - Successful flow & token verification", async () => {
    const devResult = await db.execute(sql`SELECT id, role FROM users WHERE eid = 'E0007'`);
    const dev = (devResult.rows || devResult)[0];
    const appResult = await db.execute(
      sql`SELECT id, client_id as "clientId", client_secret as "clientSecret" FROM forge_apps LIMIT 1`,
    );
    const app = (appResult.rows || appResult)[0];

    // Create a temporary auth code manually
    const code = "auth_code_ex_test_" + crypto.randomBytes(8).toString("hex");
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await db.execute(sql`
      INSERT INTO forge_auth_codes (code, app_id, user_id, expires_at, scope)
      VALUES (${code}, ${app.id}, ${dev.id}, ${expiresAt.toISOString()}, '["user.profile.read", "user.manager.read"]')
    `);

    // Run exchange handler
    const req = mockRequest({
      method: "POST",
      url: "http://localhost/api/v1/auth/exchange",
      body: {
        code,
        client_id: app.clientId,
        client_secret: decryptText(app.clientSecret),
      },
    });

    const response = await exchangeHandler(req);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.access_token).toBeDefined();
    expect(
      body.access_token.startsWith("access_token_") || body.access_token.startsWith("eyJ"),
    ).toBe(true);
    expect(body.user.id).toBe(dev.id);

    // Replay Protection: Second attempt should fail
    const replayReq = mockRequest({
      method: "POST",
      url: "http://localhost/api/v1/auth/exchange",
      body: {
        code,
        client_id: app.clientId,
        client_secret: decryptText(app.clientSecret),
      },
    });
    const replayResponse = await exchangeHandler(replayReq);
    expect(replayResponse.status).toBe(400);
    const replayBody = await replayResponse.json();
    expect(replayBody.error).toContain("already used");
  });

  test("5. Auth Exchange Route - Invalid Client Credentials", async () => {
    const devResult = await db.execute(sql`SELECT id FROM users WHERE eid = 'E0007'`);
    const dev = (devResult.rows || devResult)[0];
    const appResult = await db.execute(sql`SELECT id FROM forge_apps LIMIT 1`);
    const app = (appResult.rows || appResult)[0];

    const code = "auth_code_fail_test_" + crypto.randomBytes(8).toString("hex");
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await db.execute(sql`
      INSERT INTO forge_auth_codes (code, app_id, user_id, expires_at, scope)
      VALUES (${code}, ${app.id}, ${dev.id}, ${expiresAt.toISOString()}, '[]')
    `);

    const req = mockRequest({
      method: "POST",
      url: "http://localhost/api/v1/auth/exchange",
      body: {
        code,
        client_id: "invalid_client_id",
        client_secret: "invalid_secret",
      },
    });

    const response = await exchangeHandler(req);
    expect(response.status).toBe(401);
  });

  test("6. User Profile Route - Bearer token & scope access enforcement", async () => {
    const devResult = await db.execute(sql`SELECT id, manager_id FROM users WHERE eid = 'E0007'`);
    const dev = (devResult.rows || devResult)[0];
    const appResult = await db.execute(sql`SELECT id FROM forge_apps LIMIT 1`);
    const app = (appResult.rows || appResult)[0];

    // Generate token with profile read scope only
    const token = "access_token_profile_only_" + crypto.randomBytes(8).toString("hex");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await db.execute(sql`
      INSERT INTO forge_access_tokens (access_token, app_id, user_id, expires_at, scope)
      VALUES (${token}, ${app.id}, ${dev.id}, ${expiresAt.toISOString()}, '["user.profile.read"]')
    `);

    // Fetch user without manager read scope
    const req = mockRequest({
      method: "GET",
      url: "http://localhost/api/v1/user",
      headers: { Authorization: `Bearer ${token}` },
    });

    const response = await userHandler(req);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.user.id).toBe(dev.id);
    expect(body.user.manager).toBeUndefined(); // Should omit manager because user.manager.read scope is missing

    // Generate token with manager read scope as well
    const token2 = "access_token_manager_read_" + crypto.randomBytes(8).toString("hex");
    await db.execute(sql`
      INSERT INTO forge_access_tokens (access_token, app_id, user_id, expires_at, scope)
      VALUES (${token2}, ${app.id}, ${dev.id}, ${expiresAt.toISOString()}, '["user.profile.read", "user.manager.read"]')
    `);

    const req2 = mockRequest({
      method: "GET",
      url: "http://localhost/api/v1/user",
      headers: { Authorization: `Bearer ${token2}` },
    });

    const response2 = await userHandler(req2);
    expect(response2.status).toBe(200);
    const body2 = await response2.json();
    expect(body2.user.manager).toBeDefined();
    expect(body2.user.manager.id).toBe(dev.manager_id);
  });

  test("7. Audit Log Route - Scope permission enforcement", async () => {
    const adminResult = await db.execute(sql`SELECT id FROM users WHERE eid = 'E0002'`);
    const admin = (adminResult.rows || adminResult)[0];
    const appResult = await db.execute(sql`SELECT id FROM forge_apps LIMIT 1`);
    const app = (appResult.rows || appResult)[0];

    // Token WITHOUT audit write scope
    const badToken = "access_token_no_audit_" + crypto.randomBytes(8).toString("hex");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await db.execute(sql`
      INSERT INTO forge_access_tokens (access_token, app_id, user_id, expires_at, scope)
      VALUES (${badToken}, ${app.id}, ${admin.id}, ${expiresAt.toISOString()}, '["user.profile.read"]')
    `);

    const req = mockRequest({
      method: "POST",
      url: "http://localhost/api/v1/audit/log",
      headers: { Authorization: `Bearer ${badToken}` },
      body: { action: "unauthorized.action", severity: "WARN", payload: {} },
    });

    const response = await auditLogHandler(req);
    expect(response.status).toBe(403);

    // Token WITH audit write scope
    const goodToken = "access_token_with_audit_" + crypto.randomBytes(8).toString("hex");
    await db.execute(sql`
      INSERT INTO forge_access_tokens (access_token, app_id, user_id, expires_at, scope)
      VALUES (${goodToken}, ${app.id}, ${admin.id}, ${expiresAt.toISOString()}, '["audit.log.write"]')
    `);

    const req2 = mockRequest({
      method: "POST",
      url: "http://localhost/api/v1/audit/log",
      headers: { Authorization: `Bearer ${goodToken}` },
      body: { action: "authorized.action", severity: "INFO", payload: { debug: true } },
    });

    const response2 = await auditLogHandler(req2);
    expect(response2.status).toBe(200);
    const body2 = await response2.json();
    expect(body2.success).toBe(true);
    expect(body2.logId).toBeDefined();
  });
});
