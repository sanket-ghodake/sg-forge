import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { encryptSession } from "@backend/auth/sessionManager";
import { db } from "@database/connection";
import { POST as bulkIngestRoute } from "@frontend/app/api/admin/bulk-ingest/route";
import { sql } from "drizzle-orm";

// Helper to construct a NextRequest mock
function createNextRequest(options: {
  method: string;
  url: string;
  body?: any;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
}) {
  const headers = new Headers();
  if (options.headers) {
    for (const [key, val] of Object.entries(options.headers)) {
      headers.set(key, val);
    }
  }

  const reqOptions: RequestInit = {
    method: options.method,
    headers,
  };

  if (options.body && options.method !== "GET") {
    reqOptions.body = JSON.stringify(options.body);
  }

  const req = new Request(options.url, reqOptions) as any;
  req.cookies = {
    get: (name: string) => {
      const val = options.cookies?.[name];
      return val ? { value: val } : undefined;
    },
  };
  return req;
}

describe("Organizational Hierarchy Bulk Ingestion & Single Creation Tests", () => {
  let adminId: string;
  let adminSessionToken: string;

  beforeAll(async () => {
    // 0. Clean up any existing test data to ensure clean state
    await db.execute(
      sql`DELETE FROM system_logs WHERE user_id IN (SELECT id FROM users WHERE eid IN ('E_INGEST_ADMIN', 'E_INGEST_EMP1', 'E_INGEST_EMP2', 'E_INGEST_EMP3'))`,
    );
    await db.execute(
      sql`DELETE FROM user_org_nodes WHERE user_id IN (SELECT id FROM users WHERE eid IN ('E_INGEST_ADMIN', 'E_INGEST_EMP1', 'E_INGEST_EMP2', 'E_INGEST_EMP3'))`,
    );
    await db.execute(
      sql`DELETE FROM users WHERE eid IN ('E_INGEST_ADMIN', 'E_INGEST_EMP1', 'E_INGEST_EMP2', 'E_INGEST_EMP3')`,
    );
    await db.execute(
      sql`DELETE FROM structural_metadata WHERE name IN ('Ingest Test Eng', 'Ingest Test Dev', 'Ingest Test Desig')`,
    );

    // 1. Create an admin user to perform the actions
    const adminRes = await db.execute(sql`
      INSERT INTO users (eid, name, email, role, password_hash, is_password_changed)
      VALUES ('E_INGEST_ADMIN', 'Ingest Admin', 'admin@ingest-test.com', 'admin', 'hash', true)
      RETURNING id;
    `);
    adminId = ((adminRes.rows || adminRes)[0] as any).id;

    adminSessionToken = await encryptSession({
      id: adminId,
      eid: "E_INGEST_ADMIN",
      email: "admin@ingest-test.com",
      name: "Ingest Admin",
      role: "admin",
      isPasswordChanged: true,
    });
  });

  afterAll(async () => {
    // Clean up test users and metadata
    await db.execute(
      sql`DELETE FROM system_logs WHERE user_id IN (SELECT id FROM users WHERE eid IN ('E_INGEST_ADMIN', 'E_INGEST_EMP1', 'E_INGEST_EMP2', 'E_INGEST_EMP3'))`,
    );
    await db.execute(
      sql`DELETE FROM user_org_nodes WHERE user_id IN (SELECT id FROM users WHERE eid IN ('E_INGEST_ADMIN', 'E_INGEST_EMP1', 'E_INGEST_EMP2', 'E_INGEST_EMP3'))`,
    );
    await db.execute(
      sql`DELETE FROM users WHERE eid IN ('E_INGEST_ADMIN', 'E_INGEST_EMP1', 'E_INGEST_EMP2', 'E_INGEST_EMP3')`,
    );
    await db.execute(
      sql`DELETE FROM structural_metadata WHERE name IN ('Ingest Test Eng', 'Ingest Test Dev', 'Ingest Test Desig')`,
    );
  });

  test("1. Unauthorized ingestion block for non-admin profiles", async () => {
    // Non-admin session token
    const userSessionToken = await encryptSession({
      id: "some-user-id",
      eid: "E_INGEST_USER",
      email: "user@ingest-test.com",
      name: "Ingest User",
      role: "user",
      isPasswordChanged: true,
    });

    const req = createNextRequest({
      method: "POST",
      url: "http://localhost/api/admin/bulk-ingest",
      body: { data: [] },
      cookies: { session_token: userSessionToken },
    });

    const res = await bulkIngestRoute(req);
    expect(res.status).toBe(401);
  });

  test("2. Bulk Ingest successful creation with dynamic metadata generation", async () => {
    const ingestData = [
      {
        eid: "E_INGEST_EMP1",
        name: "Ingest Employee One",
        email: "emp1@ingest-test.com",
        role: "user",
        designation: "Ingest Test Desig",
        vertical: "Ingest Test Eng",
      },
      {
        eid: "E_INGEST_EMP2",
        name: "Ingest Employee Two",
        email: "emp2@ingest-test.com",
        role: "user",
        designation: "Ingest Test Desig",
        vertical: "Ingest Test Dev",
        managerEid: "E_INGEST_EMP1",
      },
    ];

    const req = createNextRequest({
      method: "POST",
      url: "http://localhost/api/admin/bulk-ingest",
      body: { data: ingestData },
      cookies: { session_token: adminSessionToken },
    });

    const res = await bulkIngestRoute(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.results).toHaveLength(2);
    expect(body.results[0].status).toBe("created");
    expect(body.results[1].status).toBe("created");

    // Check database to verify that users are created and reporting manager is correctly set
    const emp1Check = await db.execute(
      sql`SELECT id, designation_id, vertical_id FROM users WHERE eid = 'E_INGEST_EMP1'`,
    );
    const emp1 = (emp1Check.rows || emp1Check)[0];
    expect(emp1).toBeDefined();

    const emp2Check = await db.execute(
      sql`SELECT id, manager_id FROM users WHERE eid = 'E_INGEST_EMP2'`,
    );
    const emp2 = (emp2Check.rows || emp2Check)[0];
    expect(emp2).toBeDefined();
    expect(emp2.manager_id).toBe(emp1.id);

    // Verify metadata auto-created correctly
    const metaCheck = await db.execute(
      sql`SELECT id, name, type FROM structural_metadata WHERE id = ${emp1.designation_id}`,
    );
    const meta = (metaCheck.rows || metaCheck)[0];
    expect(meta).toBeDefined();
    expect(meta.name).toBe("Ingest Test Desig");
    expect(meta.type).toBe("job_level");
  });

  test("3. Bulk Ingest updates existing profiles (Upsert validation)", async () => {
    const updateData = [
      {
        eid: "E_INGEST_EMP1",
        name: "Ingest Employee One Updated",
        email: "emp1-updated@ingest-test.com",
        role: "user",
        designation: "Ingest Test Desig",
        vertical: "Ingest Test Eng",
      },
    ];

    const req = createNextRequest({
      method: "POST",
      url: "http://localhost/api/admin/bulk-ingest",
      body: { data: updateData },
      cookies: { session_token: adminSessionToken },
    });

    const res = await bulkIngestRoute(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.results[0].status).toBe("updated");

    // Verify change in DB
    const dbCheck = await db.execute(
      sql`SELECT name, email FROM users WHERE eid = 'E_INGEST_EMP1'`,
    );
    const emp = (dbCheck.rows || dbCheck)[0];
    expect(emp.name).toBe("Ingest Employee One Updated");
    expect(emp.email).toBe("emp1-updated@ingest-test.com");
  });

  test("4. Validation error for missing required properties", async () => {
    const invalidData = [
      {
        eid: "E_INGEST_EMP3",
        // Name is missing
        email: "emp3@ingest-test.com",
      },
    ];

    const req = createNextRequest({
      method: "POST",
      url: "http://localhost/api/admin/bulk-ingest",
      body: { data: invalidData },
      cookies: { session_token: adminSessionToken },
    });

    const res = await bulkIngestRoute(req);
    const body = await res.json();

    expect(res.status).toBe(200); // Route processes row-by-row and returns individual errors in results
    expect(body.success).toBe(true);
    expect(body.results[0].status).toBe("error");
    expect(body.results[0].error).toContain("Missing EID, Name, or Email");
  });

  test("5. Single user creation simulation via SQL", async () => {
    // Simulates the Single User creation flow in AdminPanel:
    const randomId = crypto.randomUUID();
    // nosemgrep: generic.secrets.security.detected-bcrypt-hash.detected-bcrypt-hash
    const defaultPasswordHash = "$2b$10$8Gub3V3ScET0bRZPdM8ONeG543SkOwVKLcfO6jU0CjmGlGxPRrAVm";

    await db.execute(sql`
      INSERT INTO users (id, eid, name, email, password_hash, is_password_changed, role)
      VALUES (
        ${randomId},
        'E_INGEST_EMP3',
        'Ingest Employee Three',
        'emp3@ingest-test.com',
        ${defaultPasswordHash},
        false,
        'user'
      )
    `);

    // Verify presence in DB
    const check = await db.execute(sql`SELECT id, name FROM users WHERE eid = 'E_INGEST_EMP3'`);
    const emp = (check.rows || check)[0];
    expect(emp).toBeDefined();
    expect(emp.name).toBe("Ingest Employee Three");
  });
});
