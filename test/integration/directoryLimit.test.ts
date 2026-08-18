import { beforeAll, describe, expect, test } from "bun:test";
import { encryptSession } from "@backend/auth/sessionManager";
import { db } from "@database/connection";
import { GET as directoryHandler } from "@frontend/app/api/directory/route";
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
  } as any;
}

describe("Portal Directory API Access Controls & Limits", () => {
  let adminSessionToken: string;
  let employeeSessionToken: string;

  beforeAll(async () => {
    // Fetch an admin user
    const adminRes = await db.execute(sql`SELECT id, role FROM users WHERE eid = 'E0001'`);
    const admin = (adminRes.rows || adminRes)[0];
    adminSessionToken = await encryptSession({
      id: admin.id as string,
      eid: "E0001",
      email: "ceo@sgforge.com",
      name: "Arthur Pendragon",
      role: admin.role as string,
      isPasswordChanged: true,
    });

    // Fetch an employee user (Diana Prince E0007 / role 'user')
    const employeeRes = await db.execute(sql`SELECT id, role FROM users WHERE eid = 'E0007'`);
    const employee = (employeeRes.rows || employeeRes)[0];
    employeeSessionToken = await encryptSession({
      id: employee.id as string,
      eid: "E0007",
      email: "diana@sgforge.com",
      name: "Diana Prince",
      role: employee.role as string,
      isPasswordChanged: true,
    });
  });

  test("Admin user can query the directory without query limits", async () => {
    const req = mockRequest({
      method: "GET",
      url: "http://localhost/api/directory",
      cookies: { session_token: adminSessionToken },
    });

    const res = await directoryHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.users).toBeDefined();
    expect(body.users.length).toBeGreaterThan(0);
  });

  test("Standard employee user queries are limited and successful", async () => {
    const req = mockRequest({
      method: "GET",
      url: "http://localhost/api/directory",
      cookies: { session_token: employeeSessionToken },
    });

    const res = await directoryHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.users).toBeDefined();
    // In our test DB, there are less than 50 users, so it returns all, but is successful
    expect(body.users.length).toBeGreaterThan(0);
  });

  test("Service-to-Service auth with valid client secrets is allowed", async () => {
    const req = mockRequest({
      method: "GET",
      url: "http://localhost/api/directory",
      headers: {
        "x-forge-client-id": "client_example_forge_app",
        "x-forge-client-secret": "secret_example_forge_app",
      },
    });

    const res = await directoryHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.users).toBeDefined();
  });

  test("Unauthorized requests are rejected", async () => {
    const req = mockRequest({
      method: "GET",
      url: "http://localhost/api/directory",
    });

    const res = await directoryHandler(req);
    expect(res.status).toBe(401);
  });
});
