import { beforeAll, describe, expect, test } from "bun:test";
import { encryptSession } from "@backend/auth/sessionManager";
import { validateAppAccess } from "@backend/middleware/proxyGuard";
import { db, roDb } from "@database/connection";
// Import handlers to execute integration tests
import { POST as handshakeHandler } from "@frontend/app/api/apps/handshake/route";
import { GET as proxyHandler } from "@frontend/app/api/forge-apps/[slug]/[[...path]]/route";
import { POST as queryHandler } from "@frontend/app/api/query/route";
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
  const urlObj = new URL(options.url);
  return {
    method: options.method,
    url: options.url,
    nextUrl: urlObj,
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
    text: async () => JSON.stringify(options.body || {}),
  } as any;
}

describe("Forge Portal Security Integration Tests", () => {
  let superAdminToken: string;
  let allowedUserToken: string; // Alice Smith (Level 3 - Manager, Engineering)
  let forbiddenUserToken: string; // Charlie Brown (Level 1 - Software Engineer, Engineering)

  beforeAll(async () => {
    // 1. Fetch Super Admin
    const superAdminRes = await db.execute(sql`SELECT id, role FROM users WHERE eid = 'E0001'`);
    const superAdmin = (superAdminRes.rows || superAdminRes)[0];
    superAdminToken = await encryptSession({
      id: superAdmin.id as string,
      eid: "E0001",
      email: "admin@sgforge.com",
      name: "Super Admin",
      role: superAdmin.role as string,
      isPasswordChanged: true,
    });
    // 2. Fetch Alice Smith (Engineering Manager - Allowed on Nexus)
    const aliceRes = await db.execute(sql`SELECT id, role FROM users WHERE eid = 'E0005'`);
    const alice = (aliceRes.rows || aliceRes)[0];
    allowedUserToken = await encryptSession({
      id: alice.id as string,
      eid: "E0005",
      email: "alice@sgforge.com",
      name: "Alice Smith",
      role: alice.role as string,
      isPasswordChanged: true,
    });

    // 3. Fetch Charlie Brown (Software Engineer - Forbidden on Nexus because Level 1 < Min 2)
    const charlieRes = await db.execute(sql`SELECT id, role FROM users WHERE eid = 'E0007'`);
    const charlie = (charlieRes.rows || charlieRes)[0];
    forbiddenUserToken = await encryptSession({
      id: charlie.id as string,
      eid: "E0007",
      email: "charlie@sgforge.com",
      name: "Charlie Brown",
      role: charlie.role as string,
      isPasswordChanged: true,
    });
  });

  describe("P0.1: Handshake and Proxy Privilege Escalation Checks", () => {
    test("validateAppAccess directly flags Charlie Brown as unauthorized and Alice as authorized", async () => {
      const charlieRes = await db.execute(sql`SELECT id, role FROM users WHERE eid = 'E0007'`);
      const charlieId = (charlieRes.rows || charlieRes)[0].id;

      const aliceRes = await db.execute(sql`SELECT id, role FROM users WHERE eid = 'E0005'`);
      const aliceId = (aliceRes.rows || aliceRes)[0].id;

      const charlieAccess = await validateAppAccess(
        charlieId as string,
        "user",
        "nexus-provisioning",
      );
      const aliceAccess = await validateAppAccess(aliceId as string, "user", "nexus-provisioning");

      expect(charlieAccess).toBe(false);
      expect(aliceAccess).toBe(true);
    });

    test("Handshake Endpoint: Charlie Brown gets 403, Alice Smith gets 200", async () => {
      const forbiddenReq = mockRequest({
        method: "POST",
        url: "http://localhost/api/apps/handshake",
        cookies: { session_token: forbiddenUserToken },
        body: { slug: "nexus-provisioning" },
      });
      const forbiddenRes = await handshakeHandler(forbiddenReq);
      expect(forbiddenRes.status).toBe(403);
      const forbiddenBody = await forbiddenRes.json();
      expect(forbiddenBody.error).toContain("restricted");

      const allowedReq = mockRequest({
        method: "POST",
        url: "http://localhost/api/apps/handshake",
        cookies: { session_token: allowedUserToken },
        body: { slug: "nexus-provisioning" },
      });
      const allowedRes = await handshakeHandler(allowedReq);
      expect(allowedRes.status).toBe(200);
      const allowedBody = await allowedRes.json();
      expect(allowedBody.code).toBeDefined();
    });

    test("Proxy Endpoint: Charlie Brown gets 403, Alice Smith gets 200/404/fallback", async () => {
      const context = { params: Promise.resolve({ slug: "nexus-provisioning" }) };

      const forbiddenReq = mockRequest({
        method: "GET",
        url: "http://localhost/api/forge-apps/nexus-provisioning",
        cookies: { session_token: forbiddenUserToken },
      });
      const forbiddenRes = await proxyHandler(forbiddenReq, context);
      expect(forbiddenRes.status).toBe(403);

      const allowedReq = mockRequest({
        method: "GET",
        url: "http://localhost/api/forge-apps/nexus-provisioning",
        cookies: { session_token: allowedUserToken },
      });
      const allowedRes = await proxyHandler(allowedReq, context);
      // Can be 200 (serving simulated fallback or live site) or other non-403 codes
      expect(allowedRes.status).not.toBe(403);
    });
  });

  describe("P0.2: SQL Workbench Raw Injection and Role Lock Checks", () => {
    test("Query Endpoint: Non-super_admin user (Alice) gets 403 Forbidden", async () => {
      const req = mockRequest({
        method: "POST",
        url: "http://localhost/api/query",
        cookies: { session_token: allowedUserToken },
        body: { query: "SELECT * FROM users;" },
      });
      const res = await queryHandler(req);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toContain("Only administrative roles can execute raw SQL queries");
    });

    test("Query Endpoint: Super Admin user gets 200 OK", async () => {
      const req = mockRequest({
        method: "POST",
        url: "http://localhost/api/query",
        cookies: { session_token: superAdminToken },
        body: { query: "SELECT id, name FROM users LIMIT 1;" },
      });
      const res = await queryHandler(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.rows).toBeDefined();
    });

    test("roDb Connection Pool: Restricts write operations", async () => {
      // Trying to insert a record into users using roDb must throw a transaction read-only error
      let errorThrown = false;
      try {
        await roDb.execute(sql`
          INSERT INTO users (eid, name, email, password_hash, role)
          VALUES ('E_TEST_ERR', 'Test Error', 'tester@sgforge.com', 'hash', 'user')
        `);
      } catch (err: any) {
        errorThrown = true;
        const fullMessage = `${err.message} ${err.cause?.message || ""}`;
        expect(fullMessage).toContain("read-only transaction");
      }
      expect(errorThrown).toBe(true);
    });
  });
});
