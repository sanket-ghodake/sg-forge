import { beforeAll, describe, expect, test } from "bun:test";
import { hasAppAccess } from "@backend/auth/permissionEngine";
import { encryptSession } from "@backend/auth/sessionManager";
import { db } from "@database/connection";
import { POST as approveRequest } from "@frontend/app/api/v1/marketplace/approve-request/route";
import { GET as getMarketplaceApps } from "@frontend/app/api/v1/marketplace/apps/route";
import {
  DELETE as deleteEntitlement,
  GET as getEntitlements,
} from "@frontend/app/api/v1/marketplace/entitlements/route";
import { POST as requestAccess } from "@frontend/app/api/v1/marketplace/request-access/route";
import { GET as getRequests } from "@frontend/app/api/v1/marketplace/requests/route";
// Import Next.js route handlers directly to run serverless integrations
import { GET as getOrgContext } from "@frontend/app/api/v1/org/context/route";
import { GET as getOrgHierarchy } from "@frontend/app/api/v1/org/hierarchy/route";
import { GET as verifyRelationship } from "@frontend/app/api/v1/org/hierarchy/verify-relationship/route";
import { GET as getProjects } from "@frontend/app/api/v1/org/projects/route";
import crypto from "crypto";
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

describe("Enterprise Hierarchy, Circular Loops, Entitlements & Marketplace Tests", () => {
  let userAId: string;
  let userBId: string;
  let userCId: string;

  let nodeTypeId: string;
  let nodeAId: string;
  let nodeBId: string;
  let nodeCId: string;

  let testAppId: string;

  beforeAll(async () => {
    // 0. Clean up any existing test data from previous runs to ensure idempotency
    await db.execute(
      sql`DELETE FROM user_org_nodes WHERE user_id IN (SELECT id FROM users WHERE eid IN ('E_TEST_A', 'E_TEST_B', 'E_TEST_C'))`,
    );
    await db.execute(
      sql`DELETE FROM forge_app_entitlements WHERE app_id IN (SELECT id FROM forge_apps WHERE slug = 'entitlements-test')`,
    );
    await db.execute(
      sql`DELETE FROM forge_app_access_requests WHERE app_id IN (SELECT id FROM forge_apps WHERE slug = 'entitlements-test')`,
    );
    await db.execute(sql`DELETE FROM forge_apps WHERE slug = 'entitlements-test'`);
    await db.execute(sql`DELETE FROM users WHERE eid IN ('E_TEST_A', 'E_TEST_B', 'E_TEST_C')`);
    await db.execute(
      sql`DELETE FROM org_nodes WHERE name IN ('Parent Node A', 'Child Node B', 'Grandchild Node C')`,
    );
    await db.execute(sql`DELETE FROM org_node_types WHERE name = 'test_type'`);
    await db.execute(sql`DELETE FROM structural_metadata WHERE name = 'L5 Lead Engineer'`);

    // 1. Create test designations/verticals if needed
    const designationRes = await db.execute(sql`
      INSERT INTO structural_metadata (type, name, sort_order)
      VALUES ('designation', 'L5 Lead Engineer', 50)
      RETURNING id;
    `);
    const desigId = (designationRes.rows || designationRes)[0].id;

    // 2. Insert test users
    const uARes = await db.execute(sql`
      INSERT INTO users (eid, name, email, role, password_hash, designation_id)
      VALUES ('E_TEST_A', 'Alice Tester', 'alice@test.com', 'user', 'hash', ${desigId})
      RETURNING id;
    `);
    userAId = (uARes.rows || uARes)[0].id;

    const uBRes = await db.execute(sql`
      INSERT INTO users (eid, name, email, role, password_hash, designation_id, manager_id)
      VALUES ('E_TEST_B', 'Bob Tester', 'bob@test.com', 'user', 'hash', ${desigId}, ${userAId})
      RETURNING id;
    `);
    userBId = (uBRes.rows || uBRes)[0].id;

    const uCRes = await db.execute(sql`
      INSERT INTO users (eid, name, email, role, password_hash, designation_id, manager_id)
      VALUES ('E_TEST_C', 'Charlie Tester', 'charlie@test.com', 'user', 'hash', ${desigId}, ${userBId})
      RETURNING id;
    `);
    userCId = (uCRes.rows || uCRes)[0].id;

    // 3. Insert org node types & nodes
    const typeRes = await db.execute(sql`
      INSERT INTO org_node_types (name, sort_order)
      VALUES ('test_type', 10)
      RETURNING id;
    `);
    nodeTypeId = (typeRes.rows || typeRes)[0].id;

    const nARes = await db.execute(sql`
      INSERT INTO org_nodes (node_type_id, name, parent_id, path)
      VALUES (${nodeTypeId}, 'Parent Node A', NULL, 'Top.ParentA')
      RETURNING id;
    `);
    nodeAId = (nARes.rows || nARes)[0].id;

    const nBRes = await db.execute(sql`
      INSERT INTO org_nodes (node_type_id, name, parent_id, path)
      VALUES (${nodeTypeId}, 'Child Node B', ${nodeAId}, 'Top.ParentA.ChildB')
      RETURNING id;
    `);
    nodeBId = (nBRes.rows || nBRes)[0].id;

    const nCRes = await db.execute(sql`
      INSERT INTO org_nodes (node_type_id, name, parent_id, path)
      VALUES (${nodeTypeId}, 'Grandchild Node C', ${nodeBId}, 'Top.ParentA.ChildB.GrandchildC')
      RETURNING id;
    `);
    nodeCId = (nCRes.rows || nCRes)[0].id;

    // 4. Insert dynamic app for access checks
    const appRes = await db.execute(sql`
      INSERT INTO forge_apps (name, slug, entry_url, is_enabled, target_rules)
      VALUES ('Entitlements Test App', 'entitlements-test', 'http://test', true, '{}'::jsonb)
      RETURNING id;
    `);
    testAppId = (appRes.rows || appRes)[0].id;
  });

  test("1. Circular reporting prevention trigger (Users)", async () => {
    // Alice is Bob's manager. Bob is Charlie's manager.
    // Try to make Alice report to Charlie. Should fail.
    let thrownError: Error | null = null;
    try {
      await db.execute(sql`
        UPDATE users
        SET manager_id = ${userCId}
        WHERE id = ${userAId}
      `);
    } catch (e: any) {
      thrownError = e;
    }

    expect(thrownError).toBeDefined();
    const msgA = `${thrownError!.message} ${thrownError!.cause?.message || ""}`;
    expect(msgA).toContain("Circular reporting loop detected");
  });

  test("2. Circular node reference prevention trigger (Org Nodes)", async () => {
    // Parent Node A -> Child Node B -> Grandchild Node C.
    // Try to set Parent Node A's parent to Grandchild Node C. Should fail.
    let thrownError: Error | null = null;
    try {
      await db.execute(sql`
        UPDATE org_nodes
        SET parent_id = ${nodeCId}
        WHERE id = ${nodeAId}
      `);
    } catch (e: any) {
      thrownError = e;
    }

    expect(thrownError).toBeDefined();
    const msgB = `${thrownError!.message} ${thrownError!.cause?.message || ""}`;
    expect(msgB).toContain("Circular node reference loop detected");
  });

  test("2b. Admin separation constraints trigger", async () => {
    // 1. Try to set manager_id on a super_admin or admin
    let thrownError: Error | null = null;
    try {
      await db.execute(sql`
        INSERT INTO users (eid, name, email, role, password_hash, manager_id)
        VALUES ('E_ADMIN_FAIL_1', 'Fail Admin 1', 'fail1@admin.com', 'admin', 'hash', ${userAId})
      `);
    } catch (e: any) {
      thrownError = e;
    }
    expect(thrownError).toBeDefined();
    const msgC1 = `${thrownError!.message} ${thrownError!.cause?.message || ""}`;
    expect(msgC1).toContain("Admin separation violation");

    // 2. Try to set designation_id on a super_admin or admin
    thrownError = null;
    try {
      // Find designation ID
      const desigRes = await db.execute(
        sql`SELECT id FROM structural_metadata WHERE type = 'job_level' LIMIT 1`,
      );
      const desigId = (desigRes.rows || desigRes)[0]?.id;
      if (desigId) {
        await db.execute(sql`
          INSERT INTO users (eid, name, email, role, password_hash, designation_id)
          VALUES ('E_ADMIN_FAIL_2', 'Fail Admin 2', 'fail2@admin.com', 'admin', 'hash', ${desigId})
        `);
      } else {
        throw new Error("No designation found");
      }
    } catch (e: any) {
      thrownError = e;
    }
    expect(thrownError).toBeDefined();
    const msgC2 = `${thrownError!.message} ${thrownError!.cause?.message || ""}`;
    expect(msgC2).toContain("Admin separation violation");

    // 3. Try to make a standard user report to an admin
    // Insert an admin with no manager/designation/vertical
    const adminRes = await db.execute(sql`
      INSERT INTO users (eid, name, email, role, password_hash)
      VALUES ('E_ADMIN_OK', 'Ok Admin', 'ok@admin.com', 'admin', 'hash')
      RETURNING id
    `);
    const newAdminId = (adminRes.rows || adminRes)[0].id;

    thrownError = null;
    try {
      // Try to make a user report to this new admin
      await db.execute(sql`
        INSERT INTO users (eid, name, email, role, password_hash, manager_id)
        VALUES ('E_USER_FAIL', 'Fail User', 'failuser@user.com', 'user', 'hash', ${newAdminId})
      `);
    } catch (e: any) {
      thrownError = e;
    }
    expect(thrownError).toBeDefined();
    const msgC3 = `${thrownError!.message} ${thrownError!.cause?.message || ""}`;
    expect(msgC3).toContain("Admin separation violation");

    // Clean up
    await db.execute(
      sql`DELETE FROM users WHERE eid IN ('E_ADMIN_OK', 'E_ADMIN_FAIL_1', 'E_ADMIN_FAIL_2', 'E_USER_FAIL')`,
    );
  });

  test("3. Reporting relationship query (Recursive Line Management verification)", async () => {
    const sessionToken = await encryptSession({
      id: userAId,
      eid: "E_TEST_A",
      email: "alice@test.com",
      name: "Alice Tester",
      role: "user",
      isPasswordChanged: true,
    });

    // Verify Bob reports to Alice (Direct report, distance = 1)
    const req1 = createNextRequest({
      method: "GET",
      url: `http://localhost/api/v1/org/hierarchy/verify-relationship?employee_id=${userBId}&manager_id=${userAId}`,
      cookies: { session_token: sessionToken },
    });
    const res1 = await verifyRelationship(req1);
    const body1 = await res1.json();

    expect(res1.status).toBe(200);
    expect(body1.isDirectReport).toBe(true);
    expect(body1.isIndirectReport).toBe(false);
    expect(body1.reportingDistance).toBe(1);

    // Verify Charlie reports to Alice (Indirect report, distance = 2)
    const req2 = createNextRequest({
      method: "GET",
      url: `http://localhost/api/v1/org/hierarchy/verify-relationship?employee_id=${userCId}&manager_id=${userAId}`,
      cookies: { session_token: sessionToken },
    });
    const res2 = await verifyRelationship(req2);
    const body2 = await res2.json();

    expect(res2.status).toBe(200);
    expect(body2.isDirectReport).toBe(false);
    expect(body2.isIndirectReport).toBe(true);
    expect(body2.reportingDistance).toBe(2);

    // Verify Alice reports to Charlie (No reporting relationship)
    const req3 = createNextRequest({
      method: "GET",
      url: `http://localhost/api/v1/org/hierarchy/verify-relationship?employee_id=${userAId}&manager_id=${userCId}`,
      cookies: { session_token: sessionToken },
    });
    const res3 = await verifyRelationship(req3);
    const body3 = await res3.json();

    expect(res3.status).toBe(200);
    expect(body3.isDirectReport).toBe(false);
    expect(body3.isIndirectReport).toBe(false);
    expect(body3.reportingDistance).toBeNull();
  });

  test("4. Granular Entitlements Engine (Deny-Overrides-Grant Logic)", async () => {
    // Default: no entitlements, so hasAppAccess should return true (fallback to empty rules)
    let access = await hasAppAccess(userAId, testAppId);
    expect(access).toBe(true);

    // Insert positive grant for userAId
    await db.execute(sql`
      INSERT INTO forge_app_entitlements (app_id, subject_type, subject_id, access_type)
      VALUES (${testAppId}, 'user', ${userAId}, 'grant');
    `);

    access = await hasAppAccess(userAId, testAppId);
    expect(access).toBe(true);

    // Insert explicit deny at org node level
    // Assign userAId to Child Node B
    await db.execute(sql`
      INSERT INTO user_org_nodes (user_id, node_id, role_type, is_primary)
      VALUES (${userAId}, ${nodeBId}, 'member', true);
    `);

    // Insert deny policy for Child Node B
    await db.execute(sql`
      INSERT INTO forge_app_entitlements (app_id, subject_type, subject_id, access_type)
      VALUES (${testAppId}, 'org_node', ${nodeBId}, 'deny');
    `);

    // Explicit deny on node B overrides positive grant on userAId!
    access = await hasAppAccess(userAId, testAppId);
    expect(access).toBe(false);
  });

  test("5. Marketplace request-access & approval workflow", async () => {
    // Charlie Tester wants to request access to the test app
    const charlieSession = await encryptSession({
      id: userCId,
      eid: "E_TEST_C",
      email: "charlie@test.com",
      name: "Charlie Tester",
      role: "user",
      isPasswordChanged: true,
    });

    const reqReq = createNextRequest({
      method: "POST",
      url: "http://localhost/api/v1/marketplace/request-access",
      body: {
        appId: testAppId,
        reason: "Need to view logs.",
        scope: "individual",
      },
      cookies: { session_token: charlieSession },
    });
    const reqRes = await requestAccess(reqReq);
    const reqBody = await reqRes.json();

    expect(reqRes.status).toBe(200);
    expect(reqBody.success).toBe(true);
    const requestId = reqBody.requestId;
    expect(requestId).toBeDefined();

    // Now let's approve it as a Super Admin
    const superAdminSession = await encryptSession({
      id: userAId, // Let's pretend Alice is a super admin for this session context
      eid: "E_TEST_A",
      email: "alice@test.com",
      name: "Alice Tester",
      role: "super_admin",
      isPasswordChanged: true,
    });

    const approveReq = createNextRequest({
      method: "POST",
      url: "http://localhost/api/v1/marketplace/approve-request",
      body: {
        requestId,
        status: "approved",
        notes: "Approved by Super Admin",
      },
      cookies: { session_token: superAdminSession },
    });
    const approveRes = await approveRequest(approveReq);
    const approveBody = await approveRes.json();

    expect(approveRes.status).toBe(200);
    expect(approveBody.success).toBe(true);
    expect(approveBody.nextStatus).toBe("approved");

    // Verify entitlement has been provisioned to Charlie
    const accessCharlie = await hasAppAccess(userCId, testAppId);
    expect(accessCharlie).toBe(true);
  });

  test("6. Retrieve hierarchy nodes and active projects for marketplace pre-fills", async () => {
    const session = await encryptSession({
      id: userAId,
      eid: "E_TEST_A",
      email: "alice@test.com",
      name: "Alice Tester",
      role: "admin",
      isPasswordChanged: true,
    });

    const hierarchyReq = createNextRequest({
      method: "GET",
      url: "http://localhost/api/v1/org/hierarchy",
      cookies: { session_token: session },
    });
    const hierarchyRes = await getOrgHierarchy(hierarchyReq);
    const hierarchyBody = await hierarchyRes.json();

    expect(hierarchyRes.status).toBe(200);
    expect(hierarchyBody.success).toBe(true);
    expect(Array.isArray(hierarchyBody.nodes)).toBe(true);

    const projectsReq = createNextRequest({
      method: "GET",
      url: "http://localhost/api/v1/org/projects",
      cookies: { session_token: session },
    });
    const projectsRes = await getProjects(projectsReq);
    const projectsBody = await projectsRes.json();

    expect(projectsRes.status).toBe(200);
    expect(projectsBody.success).toBe(true);
    expect(Array.isArray(projectsBody.projects)).toBe(true);
  });

  test("7. Entitlements audit, listing, and administrative revocation", async () => {
    const session = await encryptSession({
      id: userAId,
      eid: "E_TEST_A",
      email: "alice@test.com",
      name: "Alice Tester",
      role: "super_admin",
      isPasswordChanged: true,
    });

    // List entitlements
    const listReq = createNextRequest({
      method: "GET",
      url: "http://localhost/api/v1/marketplace/entitlements",
      cookies: { session_token: session },
    });
    const listRes = await getEntitlements(listReq);
    const listBody = await listRes.json();

    expect(listRes.status).toBe(200);
    expect(listBody.success).toBe(true);
    expect(Array.isArray(listBody.entitlements)).toBe(true);

    // Find the entitlement we just added for Charlie (userCId)
    const charlieEnt = listBody.entitlements.find(
      (e: any) => e.appId === testAppId && e.subjectId === userCId,
    );
    expect(charlieEnt).toBeDefined();

    // Revoke the entitlement
    const revokeReq = createNextRequest({
      method: "DELETE",
      url: `http://localhost/api/v1/marketplace/entitlements?id=${charlieEnt.id}`,
      cookies: { session_token: session },
    });
    const revokeRes = await deleteEntitlement(revokeReq);
    const revokeBody = await revokeRes.json();

    expect(revokeRes.status).toBe(200);
    expect(revokeBody.success).toBe(true);

    // Verify entitlement has been soft-revoked in database (never physically deleted)
    const dbCheck = await db.execute(sql`
      SELECT status, revoked_by, revocation_reason FROM forge_app_entitlements WHERE id = ${charlieEnt.id}
    `);
    const row = (dbCheck.rows || dbCheck)[0];
    expect(row).toBeDefined();
    expect(row.status).toBe("revoked");
    expect(row.revoked_by).toBe(userAId);
    expect(row.revocation_reason).toBeDefined();
  });
});
