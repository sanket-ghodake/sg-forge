import { afterAll, afterEach, describe, expect, spyOn, test } from "bun:test";
import { hasAppAccess } from "@backend/auth/permissionEngine";
import { db } from "@database/connection";

// Setup mocks for database execute
const mockDbExecute = spyOn(db, "execute");

afterEach(() => {
  mockDbExecute.mockClear();
});

afterAll(() => {
  mockDbExecute.mockRestore();
});

const VALID_USER_ID = "10000000-0000-0000-0000-000000000099";
const VALID_APP_ID = "20000000-0000-0000-0000-000000000099";

function getQueryText(sqlObj: any): string {
  if (!sqlObj) return "";
  if (typeof sqlObj === "string") return sqlObj;
  if (sqlObj.queryChunks) {
    return sqlObj.queryChunks
      .map((c: any) => (Array.isArray(c.value) ? c.value.join(" ") : String(c.value || "")))
      .join(" ");
  }
  return JSON.stringify(sqlObj);
}

describe("Application Authorization & Entitlements Engine", () => {
  test("Should deny access if the application is globally disabled", async () => {
    mockDbExecute.mockImplementation(async (sqlObj: any) => {
      const q = getQueryText(sqlObj);
      if (q.includes("forge_apps WHERE slug") || q.includes("FROM forge_apps WHERE slug")) {
        return { rows: [{ id: VALID_APP_ID }], rowCount: 1 };
      }
      if (q.includes("ARRAY_AGG") && q.includes("FROM users")) {
        return {
          rows: [
            {
              userId: VALID_USER_ID,
              designationId: "desig-123",
              teamIds: [],
              projectIds: [],
              groupIds: [],
            },
          ],
          rowCount: 1,
        };
      }
      if (q.includes("ancestor.path @> direct.path")) {
        return { rows: [], rowCount: 0 };
      }
      if (q.includes("FROM user_roles")) {
        return { rows: [], rowCount: 0 };
      }
      if (q.includes("FROM forge_app_entitlements")) {
        return { rows: [], rowCount: 0 };
      }
      if (
        q.includes('SELECT id, slug, is_enabled as "isEnabled"') &&
        q.includes("FROM forge_apps")
      ) {
        return {
          rows: [{ id: VALID_APP_ID, isEnabled: false, targetRules: { minJobLevel: 1 } }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const hasAccess = await hasAppAccess(VALID_USER_ID, "manager-operations");
    expect(hasAccess).toBe(false);
  });

  test("Should allow access based on minJobLevel targeting rules if no entitlements exist", async () => {
    mockDbExecute.mockImplementation(async (sqlObj: any) => {
      const q = getQueryText(sqlObj);
      if (q.includes("forge_apps WHERE slug") || q.includes("FROM forge_apps WHERE slug")) {
        return { rows: [{ id: VALID_APP_ID }], rowCount: 1 };
      }
      if (q.includes("ARRAY_AGG") && q.includes("FROM users")) {
        return {
          rows: [
            {
              userId: VALID_USER_ID,
              designationId: "desig-123",
              teamIds: [],
              projectIds: [],
              groupIds: [],
            },
          ],
          rowCount: 1,
        };
      }
      if (q.includes("ancestor.path @> direct.path")) {
        return { rows: [], rowCount: 0 };
      }
      if (q.includes("FROM user_roles")) {
        return { rows: [], rowCount: 0 };
      }
      if (q.includes("FROM forge_app_entitlements")) {
        return { rows: [], rowCount: 0 };
      }
      if (
        q.includes('SELECT id, slug, is_enabled as "isEnabled"') &&
        q.includes("FROM forge_apps")
      ) {
        return {
          rows: [{ id: VALID_APP_ID, isEnabled: true, targetRules: { minJobLevel: 3 } }],
          rowCount: 1,
        };
      }
      if (q.includes('SELECT u.vertical_id as "verticalId"')) {
        return {
          rows: [
            {
              verticalId: "vert-123",
              designationId: "desig-123",
              jobLevel: 3,
              designation: "Manager Operations",
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const hasAccess = await hasAppAccess(VALID_USER_ID, "manager-operations");
    expect(hasAccess).toBe(true);
  });

  test("Should block access based on minJobLevel targeting rules if job level is too low", async () => {
    mockDbExecute.mockImplementation(async (sqlObj: any) => {
      const q = getQueryText(sqlObj);
      if (q.includes("forge_apps WHERE slug") || q.includes("FROM forge_apps WHERE slug")) {
        return { rows: [{ id: VALID_APP_ID }], rowCount: 1 };
      }
      if (q.includes("ARRAY_AGG") && q.includes("FROM users")) {
        return {
          rows: [
            {
              userId: VALID_USER_ID,
              designationId: "desig-123",
              teamIds: [],
              projectIds: [],
              groupIds: [],
            },
          ],
          rowCount: 1,
        };
      }
      if (q.includes("ancestor.path @> direct.path")) {
        return { rows: [], rowCount: 0 };
      }
      if (q.includes("FROM user_roles")) {
        return { rows: [], rowCount: 0 };
      }
      if (q.includes("FROM forge_app_entitlements")) {
        return { rows: [], rowCount: 0 };
      }
      if (
        q.includes('SELECT id, slug, is_enabled as "isEnabled"') &&
        q.includes("FROM forge_apps")
      ) {
        return {
          rows: [{ id: VALID_APP_ID, isEnabled: true, targetRules: { minJobLevel: 3 } }],
          rowCount: 1,
        };
      }
      if (q.includes('SELECT u.vertical_id as "verticalId"')) {
        return {
          rows: [
            {
              verticalId: "vert-123",
              designationId: "desig-123",
              jobLevel: 1,
              designation: "Staff Member",
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const hasAccess = await hasAppAccess(VALID_USER_ID, "manager-operations");
    expect(hasAccess).toBe(false);
  });

  test("Explicit user-level GRANT entitlement should override targeting rules and permit access", async () => {
    mockDbExecute.mockImplementation(async (sqlObj: any) => {
      const q = getQueryText(sqlObj);
      if (q.includes("forge_apps WHERE slug") || q.includes("FROM forge_apps WHERE slug")) {
        return { rows: [{ id: VALID_APP_ID }], rowCount: 1 };
      }
      if (q.includes("ARRAY_AGG") && q.includes("FROM users")) {
        return {
          rows: [
            {
              userId: VALID_USER_ID,
              designationId: "desig-123",
              teamIds: [],
              projectIds: [],
              groupIds: [],
            },
          ],
          rowCount: 1,
        };
      }
      if (q.includes("ancestor.path @> direct.path")) {
        return { rows: [], rowCount: 0 };
      }
      if (q.includes("FROM user_roles")) {
        return { rows: [], rowCount: 0 };
      }
      if (q.includes("FROM forge_app_entitlements")) {
        return {
          rows: [{ subjectType: "user", subjectId: VALID_USER_ID, accessType: "grant" }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const hasAccess = await hasAppAccess(VALID_USER_ID, "manager-operations");
    expect(hasAccess).toBe(true);
  });

  test("Explicit user-level DENY entitlement should override targeting rules and block access", async () => {
    mockDbExecute.mockImplementation(async (sqlObj: any) => {
      const q = getQueryText(sqlObj);
      if (q.includes("forge_apps WHERE slug") || q.includes("FROM forge_apps WHERE slug")) {
        return { rows: [{ id: VALID_APP_ID }], rowCount: 1 };
      }
      if (q.includes("ARRAY_AGG") && q.includes("FROM users")) {
        return {
          rows: [
            {
              userId: VALID_USER_ID,
              designationId: "desig-123",
              teamIds: [],
              projectIds: [],
              groupIds: [],
            },
          ],
          rowCount: 1,
        };
      }
      if (q.includes("ancestor.path @> direct.path")) {
        return { rows: [], rowCount: 0 };
      }
      if (q.includes("FROM user_roles")) {
        return { rows: [], rowCount: 0 };
      }
      if (q.includes("FROM forge_app_entitlements")) {
        return {
          rows: [{ subjectType: "user", subjectId: VALID_USER_ID, accessType: "deny" }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const hasAccess = await hasAppAccess(VALID_USER_ID, "manager-operations");
    expect(hasAccess).toBe(false);
  });
});
