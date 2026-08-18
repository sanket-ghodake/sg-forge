import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { db } from "@database/connection";

// Mock sessionManager to return a super_admin user
mock.module("@backend/auth/sessionManager", () => {
  return {
    getSession: async () => {
      return {
        id: "d3b07384-d113-4ec5-a5ae-be86064be485",
        role: "super_admin",
        email: "admin@sgforge.com",
        name: "Super Admin",
        isPasswordChanged: true,
      };
    },
  };
});

// Mock logger to avoid calling the external api
mock.module("@backend/utils/logger", () => {
  return {
    logEvent: async () => {},
  };
});

// Spy on database execution
let lastExecutedSql: string = "";
const mockDbExecute = spyOn(db, "execute").mockImplementation(async (sqlObj: any) => {
  if (sqlObj && Array.isArray(sqlObj.queryChunks)) {
    lastExecutedSql = sqlObj.queryChunks
      .map((chunk: any) => chunk.value?.[0] || String(chunk))
      .join(" ");
  } else {
    lastExecutedSql = String(sqlObj?.sql || sqlObj || "");
  }
  return {
    rows: [],
    rowCount: 1,
  };
});

afterEach(() => {
  mockDbExecute.mockClear();
  lastExecutedSql = "";
});

import { POST } from "@frontend/app/api/admin/apps/route";

describe("App Client Secret Rotation Route Handler", () => {
  test("POST with action rotate_secret updates client secret", async () => {
    const req = new Request("http://localhost/api/admin/apps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "rotate_secret",
        appId: "app-123-uuid",
      }),
    });

    const res = await POST(req as any);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.clientSecret).toBeDefined();
    expect(data.clientSecret.startsWith("secret_")).toBe(true);

    // Verify DB update was executed
    expect(lastExecutedSql).toContain("UPDATE forge_apps");
    expect(lastExecutedSql).toContain("client_secret");
  });

  test("POST with action rotate_secret and missing appId returns 400", async () => {
    const req = new Request("http://localhost/api/admin/apps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "rotate_secret",
      }),
    });

    const res = await POST(req as any);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toBe("Missing appId");
  });
});
