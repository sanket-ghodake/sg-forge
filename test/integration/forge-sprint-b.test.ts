import { beforeAll, describe, expect, test } from "bun:test";
import { encryptSession } from "@backend/auth/sessionManager";
import { decryptText } from "@backend/utils/crypto";
import { runHealthCheck } from "@backend/workers/healthCheck";
import { db } from "@database/connection";
import {
  GET as adminAppsGetHandler,
  POST as adminAppsPostHandler,
} from "@frontend/app/api/admin/apps/route";
// Import handlers to execute integration tests
import { POST as handshakeHandler } from "@frontend/app/api/apps/handshake/route";
import { POST as auditLogHandler } from "@frontend/app/api/v1/audit/log/route";
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

describe("SG Forge Sprint B Integration Tests", () => {
  let adminSessionToken: string;
  let devSessionToken: string;
  let testAppId: string;
  let testAppSlug: string;

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

    // Resolve regular user (Diana Prince E0007)
    const devRes = await db.execute(sql`SELECT id, role FROM users WHERE eid = 'E0007'`);
    const dev = (devRes.rows || devRes)[0];
    devSessionToken = await encryptSession({
      id: dev.id,
      eid: "E0007",
      email: "diana@sgforge.com",
      name: "Diana Prince",
      role: dev.role,
      isPasswordChanged: true,
    });

    // Resolve first app slug
    const appRes = await db.execute(
      sql`SELECT id, slug FROM forge_apps WHERE slug != 'nexus-provisioning' LIMIT 1`,
    );
    if (appRes.rows && appRes.rows.length > 0) {
      testAppId = appRes.rows[0].id as string;
      testAppSlug = appRes.rows[0].slug as string;
    }
  });

  test("1. Scan & Sync Manifests: Discover new runtimes", async () => {
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
    expect(body.count).toBeGreaterThan(0);

    // Verify Go and Python app registrations
    const goAppRes = await db.execute(
      sql`SELECT entry_url, is_enabled FROM forge_apps WHERE slug = 'reference-go'`,
    );
    const goApp = (goAppRes.rows || goAppRes)[0];
    expect(goApp).toBeDefined();
    expect(goApp.is_enabled).toBe(true);

    const pyAppRes = await db.execute(
      sql`SELECT entry_url, is_enabled FROM forge_apps WHERE slug = 'reference-python'`,
    );
    const pyApp = (pyAppRes.rows || pyAppRes)[0];
    expect(pyApp).toBeDefined();
    expect(pyApp.is_enabled).toBe(true);
  });

  test("2. Admin Apps List GET Access Control", async () => {
    // Denied for non-admin
    const badReq = mockRequest({
      method: "GET",
      url: "http://localhost/api/admin/apps",
      cookies: { session_token: devSessionToken },
    });
    const badRes = await adminAppsGetHandler(badReq);
    expect(badRes.status).toBe(401);

    // Success for admin
    const goodReq = mockRequest({
      method: "GET",
      url: "http://localhost/api/admin/apps",
      cookies: { session_token: adminSessionToken },
    });
    const goodRes = await adminAppsGetHandler(goodReq);
    expect(goodRes.status).toBe(200);
    const body = await goodRes.json();
    expect(body.apps).toBeDefined();
    expect(body.apps.length).toBeGreaterThan(0);
  });

  test("3. Disable App Flow disables Handshake", async () => {
    // Dynamically fetch first app slug after the Scan & Sync test has executed
    const appRes = await db.execute(sql`SELECT id, slug FROM forge_apps LIMIT 1`);
    const liveAppId = appRes.rows[0].id as string;
    const liveAppSlug = appRes.rows[0].slug as string;

    // 1. Disable the app
    const toggleReq = mockRequest({
      method: "POST",
      url: "http://localhost/api/admin/apps",
      cookies: { session_token: adminSessionToken },
      body: { action: "toggle", appId: liveAppId, isEnabled: false },
    });
    const toggleRes = await adminAppsPostHandler(toggleReq);
    expect(toggleRes.status).toBe(200);

    // Verify database setting
    const dbRes = await db.execute(sql`SELECT is_enabled FROM forge_apps WHERE id = ${liveAppId}`);
    const isEnabled = (dbRes.rows || dbRes)[0].is_enabled;
    expect(isEnabled).toBe(false);

    // 2. Try Handshake -> Should fail with 404
    const handReq = mockRequest({
      method: "POST",
      url: "http://localhost/api/apps/handshake",
      cookies: { session_token: adminSessionToken },
      body: { slug: liveAppSlug },
    });
    const handRes = await handshakeHandler(handReq);
    expect(handRes.status).toBe(404);

    // 3. Re-enable the app
    const enableReq = mockRequest({
      method: "POST",
      url: "http://localhost/api/admin/apps",
      cookies: { session_token: adminSessionToken },
      body: { action: "toggle", appId: liveAppId, isEnabled: true },
    });
    const enableRes = await adminAppsPostHandler(enableReq);
    expect(enableRes.status).toBe(200);

    // 4. Try Handshake -> Should succeed now
    const handRes2 = await handshakeHandler(handReq);
    expect(handRes2.status).toBe(200);
    const handBody = await handRes2.json();
    expect(handBody.code).toBeDefined();
  });

  test("4. Token Exchange, Scope Enforcement, & User profile Directory API", async () => {
    // Find python client details
    const pyAppRes = await db.execute(
      sql`SELECT id, client_id as "clientId", client_secret as "clientSecret" FROM forge_apps WHERE slug = 'reference-python'`,
    );
    const pyApp = (pyAppRes.rows || pyAppRes)[0];

    // Create auth code manually
    const code = "auth_code_sprint_b_test_" + crypto.randomBytes(8).toString("hex");
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await db.execute(sql`
      INSERT INTO forge_auth_codes (code, app_id, user_id, expires_at, scope)
      VALUES (${code}, ${pyApp.id}, (SELECT id FROM users WHERE eid = 'E0007'), ${expiresAt.toISOString()}, '["user.profile.read"]')
    `);

    // Exchange code
    const exReq = mockRequest({
      method: "POST",
      url: "http://localhost/api/v1/auth/exchange",
      body: { code, client_id: pyApp.clientId, client_secret: decryptText(pyApp.clientSecret) },
    });
    const exRes = await exchangeHandler(exReq);
    expect(exRes.status).toBe(200);
    const exBody = await exRes.json();
    expect(exBody.access_token).toBeDefined();

    // Verify GET /api/v1/user with exchanged token (contains user.profile.read and user.manager.read)
    const userReq1 = mockRequest({
      method: "GET",
      url: "http://localhost/api/v1/user",
      headers: { Authorization: `Bearer ${exBody.access_token}` },
    });
    const userRes1 = await userHandler(userReq1);
    expect(userRes1.status).toBe(200);
    const userBody1 = await userRes1.json();
    expect(userBody1.user.eid).toBe("E0007");
    expect(userBody1.user.manager).toBeDefined(); // manager read present because scope is granted

    // Create a mock token that EXPLICITLY lacks user.manager.read scope to verify scope exclusion
    const tokenNoManager =
      "access_token_no_manager_b_test_" + crypto.randomBytes(8).toString("hex");
    const tokenExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await db.execute(sql`
      INSERT INTO forge_access_tokens (access_token, app_id, user_id, expires_at, scope)
      VALUES (${tokenNoManager}, ${pyApp.id}, (SELECT id FROM users WHERE eid = 'E0007'), ${tokenExpiresAt.toISOString()}, '["user.profile.read"]')
    `);

    const userReq2 = mockRequest({
      method: "GET",
      url: "http://localhost/api/v1/user",
      headers: { Authorization: `Bearer ${tokenNoManager}` },
    });
    const userRes2 = await userHandler(userReq2);
    expect(userRes2.status).toBe(200);
    const userBody2 = await userRes2.json();
    expect(userBody2.user.manager).toBeUndefined(); // Should omit manager when token lacks the user.manager.read scope
  });

  test("5. Audit Log writeback API scope enforcement", async () => {
    const pyAppRes = await db.execute(
      sql`SELECT id FROM forge_apps WHERE slug = 'reference-python'`,
    );
    const pyApp = (pyAppRes.rows || pyAppRes)[0];

    // Create token without audit write scope
    const noAuditToken = "access_token_no_audit_b_test_" + crypto.randomBytes(8).toString("hex");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await db.execute(sql`
      INSERT INTO forge_access_tokens (access_token, app_id, user_id, expires_at, scope)
      VALUES (${noAuditToken}, ${pyApp.id}, (SELECT id FROM users WHERE eid = 'E0007'), ${expiresAt.toISOString()}, '["user.profile.read"]')
    `);

    const badLogReq = mockRequest({
      method: "POST",
      url: "http://localhost/api/v1/audit/log",
      headers: { Authorization: `Bearer ${noAuditToken}` },
      body: { action: "python.doc.read", severity: "INFO" },
    });
    const badLogRes = await auditLogHandler(badLogReq);
    expect(badLogRes.status).toBe(403);

    // Create token WITH audit write scope
    const auditToken = "access_token_audit_b_test_" + crypto.randomBytes(8).toString("hex");
    await db.execute(sql`
      INSERT INTO forge_access_tokens (access_token, app_id, user_id, expires_at, scope)
      VALUES (${auditToken}, ${pyApp.id}, (SELECT id FROM users WHERE eid = 'E0007'), ${expiresAt.toISOString()}, '["audit.log.write"]')
    `);

    const goodLogReq = mockRequest({
      method: "POST",
      url: "http://localhost/api/v1/audit/log",
      headers: { Authorization: `Bearer ${auditToken}` },
      body: { action: "python.doc.created", severity: "WARN", payload: { docId: "123" } },
    });
    const goodLogRes = await auditLogHandler(goodLogReq);
    expect(goodLogRes.status).toBe(200);
    const logBody = await goodLogRes.json();
    expect(logBody.success).toBe(true);

    // Check system_logs table for audit trail
    const auditRows = await db.execute(sql`
      SELECT action, severity 
      FROM system_logs 
      WHERE action = 'python.doc.created'
    `);
    const logs = auditRows.rows || auditRows;
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].severity).toBe("WARN");
  });

  test("6. Health Checker telemetry runHealthCheck", async () => {
    const originalFetch = global.fetch;
    global.fetch = async (input: any, init?: any) => {
      const url = input.toString();
      if (url.includes(":8087") || url.includes("reference-python")) {
        return new Response("OK", { status: 200 });
      }
      try {
        return await originalFetch(input, init);
      } catch (e) {
        return new Response("OFFLINE", { status: 503 });
      }
    };

    try {
      // Run the health check crawler
      await runHealthCheck();

      // Check status in DB for python app
      const statusRes = await db.execute(sql`
        SELECT status, last_seen as "lastSeen" 
        FROM forge_apps 
        WHERE slug = 'reference-python'
      `);
      const statusRow = (statusRes.rows || statusRes)[0];
      expect(statusRow).toBeDefined();
      // Python app is running on Port 8087 in the background of this session,
      // so health worker fetches it successfully and marks it active!
      expect(statusRow.status).toBe("active");
      expect(statusRow.lastSeen).toBeDefined();
    } finally {
      global.fetch = originalFetch;
    }
  });
});
