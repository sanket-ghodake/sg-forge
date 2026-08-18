import { afterAll, afterEach, describe, expect, spyOn, test } from "bun:test";
import { handleRequest } from "@backend/dev-dashboard/server";
import { db } from "@database/connection";
import * as cp from "child_process";

// Setup mocks for database execute
const mockDbExecute = spyOn(db, "execute").mockImplementation(async (sqlObj: any) => {
  return {
    rows: [],
    rowCount: 0,
  };
});

afterEach(() => {
  mockDbExecute.mockClear();
});

afterAll(() => {
  mockDbExecute.mockRestore();
});

describe("SG Forge DevCenter Dashboard Server Router Pipeline", () => {
  test("POST /api/auth with correct password sets auth session cookie", async () => {
    const req = new Request("http://localhost:3002/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "password123" }), // gitleaks:allow
    });

    const response = await handleRequest(req);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(response.headers.get("Set-Cookie")).toContain("dev_session=authenticated_sunil_dev");
  });

  test("POST /api/auth with invalid password rejects with 401", async () => {
    const req = new Request("http://localhost:3002/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "WrongPassword" }), // gitleaks:allow
    });

    const response = await handleRequest(req);
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe("Incorrect password");
  });

  test("POST /api/logout clears dev_session cookie", async () => {
    const req = new Request("http://localhost:3002/api/logout", {
      method: "POST",
    });

    const response = await handleRequest(req);
    expect(response.status).toBe(200);
    expect(response.headers.get("Set-Cookie")).toContain("dev_session=;");
  });

  test("Rejects unauthenticated API requests with 401", async () => {
    const req = new Request("http://localhost:3002/api/status", {
      method: "GET",
    });

    const response = await handleRequest(req);
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe("Unauthorized");
  });

  test("Serves login/dashboard HTML screen for unauthenticated index page fetches", async () => {
    const req = new Request("http://localhost:3002/", {
      method: "GET",
    });

    const response = await handleRequest(req);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/html");
    const body = await response.text();
    expect(body).toContain("SG Forge DevCenter");
  });

  test("GET /api/status returns database statistics for authenticated users", async () => {
    // Mock sequential db.execute queries:
    // 1st: tables fetch
    // 2nd: logs count
    // 3rd: users row count
    // 4th: key columns info
    let callCount = 0;
    mockDbExecute.mockImplementation(async (sqlObj: any) => {
      callCount++;
      if (callCount === 1) {
        return { rows: [{ table_name: "users" }], rowCount: 1 };
      }
      if (callCount === 2) {
        return { rows: [{ count: 42 }], rowCount: 1 };
      }
      if (callCount === 3) {
        return { rows: [{ count: 10 }], rowCount: 1 };
      }
      if (callCount === 4) {
        return { rows: [{ column_name: "id" }, { column_name: "name" }], rowCount: 2 };
      }
      return { rows: [], rowCount: 0 };
    });

    const req = new Request("http://localhost:3002/api/status", {
      method: "GET",
      headers: { Cookie: "dev_session=authenticated_sunil_dev" },
    });

    const response = await handleRequest(req);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.tableCount).toBe(1);
    expect(data.logsCount).toBe(42);
    expect(data.tables).toBeDefined();
    expect(data.tables[0].name).toBe("users");
    expect(data.tables[0].rows).toBe(10);
  });

  test("GET /api/tables returns table schemas for metadata explorer", async () => {
    // Mock sequential db.execute queries:
    // 1st: tables fetch
    // 2nd: structural_metadata row count
    // 3rd: columns schema info
    let callCount = 0;
    mockDbExecute.mockImplementation(async (sqlObj: any) => {
      callCount++;
      if (callCount === 1) {
        return { rows: [{ table_name: "structural_metadata" }], rowCount: 1 };
      }
      if (callCount === 2) {
        return { rows: [{ count: 5 }], rowCount: 1 };
      }
      if (callCount === 3) {
        return { rows: [{ column_name: "key", data_type: "text" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const req = new Request("http://localhost:3002/api/tables", {
      method: "GET",
      headers: { Cookie: "dev_session=authenticated_sunil_dev" },
    });

    const response = await handleRequest(req);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.tables).toBeDefined();
    expect(data.tables[0].name).toBe("structural_metadata");
    expect(data.tables[0].columns[0].name).toBe("key");
    expect(data.tables[0].columns[0].type).toBe("text");
  });

  test("POST /api/query executes query console statement successfully", async () => {
    mockDbExecute.mockImplementation(async (sqlObj: any) => {
      return { rows: [{ id: 1, name: "Admin" }], rowCount: 1 };
    });

    const req = new Request("http://localhost:3002/api/query", {
      method: "POST",
      headers: {
        Cookie: "dev_session=authenticated_sunil_dev",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: "SELECT * FROM users;" }),
    });

    const response = await handleRequest(req);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.rowCount).toBe(1);
    expect(data.rows[0].name).toBe("Admin");
  });

  test("POST /api/query throws error for empty inputs", async () => {
    const req = new Request("http://localhost:3002/api/query", {
      method: "POST",
      headers: {
        Cookie: "dev_session=authenticated_sunil_dev",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: "" }),
    });

    const response = await handleRequest(req);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("SQL query cannot be empty");
  });

  test("GET /dashboard.css serves stylesheet file", async () => {
    const req = new Request("http://localhost:3002/dashboard.css", {
      method: "GET",
    });

    const response = await handleRequest(req);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/css");
    const body = await response.text();
    expect(body).toContain("--bg-main");
  });

  test("GET /dashboard.js serves client script file", async () => {
    const req = new Request("http://localhost:3002/dashboard.js", {
      method: "GET",
    });

    const response = await handleRequest(req);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/javascript");
    const body = await response.text();
    expect(body).toContain("activeTabId");
  });

  test("POST /api/microservices/action validation works", async () => {
    const req = new Request("http://localhost:3002/api/microservices/action", {
      method: "POST",
      headers: {
        Cookie: "dev_session=authenticated_sunil_dev",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ slug: "manager-operations", action: "invalid-action" }),
    });

    const response = await handleRequest(req);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Invalid payload parameters or slug format");
  });

  test("POST /api/microservices/action with local React app in Docker mode", async () => {
    const originalEnv = process.env.RUNNING_IN_DOCKER;
    process.env.RUNNING_IN_DOCKER = "true";

    // Mock execSync to throw error for check (docker inspect manager-operations fails)
    const execSpy = spyOn(cp, "execSync").mockImplementation(() => {
      throw new Error("Command failed: docker inspect manager-operations");
    });

    try {
      const req = new Request("http://localhost:3002/api/microservices/action", {
        method: "POST",
        headers: {
          Cookie: "dev_session=authenticated_sunil_dev",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ slug: "manager-operations", action: "start" }),
      });

      const response = await handleRequest(req);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("runs natively as a local React component");
    } finally {
      execSpy.mockRestore();
      process.env.RUNNING_IN_DOCKER = originalEnv;
    }
  });

  test("POST /api/microservices/action with missing container in Docker mode", async () => {
    const originalEnv = process.env.RUNNING_IN_DOCKER;
    process.env.RUNNING_IN_DOCKER = "true";

    // Mock execSync to throw error for check (docker inspect invalid-app fails)
    const execSpy = spyOn(cp, "execSync").mockImplementation(() => {
      throw new Error("Command failed: docker inspect invalid-app");
    });

    try {
      const req = new Request("http://localhost:3002/api/microservices/action", {
        method: "POST",
        headers: {
          Cookie: "dev_session=authenticated_sunil_dev",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ slug: "invalid-app", action: "start" }),
      });

      const response = await handleRequest(req);
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain("was not found on this system");
    } finally {
      execSpy.mockRestore();
      process.env.RUNNING_IN_DOCKER = originalEnv;
    }
  });

  test("GET /api/microservices/logs with missing container in Docker mode", async () => {
    const originalEnv = process.env.RUNNING_IN_DOCKER;
    process.env.RUNNING_IN_DOCKER = "true";

    const execSpy = spyOn(cp, "execSync").mockImplementation(() => {
      throw new Error("Command failed: docker inspect invalid-app");
    });

    try {
      const req = new Request("http://localhost:3002/api/microservices/logs?slug=invalid-app", {
        method: "GET",
        headers: {
          Cookie: "dev_session=authenticated_sunil_dev",
        },
      });

      const response = await handleRequest(req);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.logs).toContain("is not running or not found");
    } finally {
      execSpy.mockRestore();
      process.env.RUNNING_IN_DOCKER = originalEnv;
    }
  });

  describe("Security and Robustness Hardening", () => {
    test("POST /api/query blocks SQL sandbox bypasses (mutations inside comments / PLpgSQL)", async () => {
      const bypassQueries = [
        "SELECT 1; UPDATE users SET name = 'hacked'",
        "DO $$ BEGIN UPDATE users SET name = 'hacked'; END $$",
        "EXECUTE 'UPDATE users SET name = = 'hacked''",
        "EXPLAIN ANALYZE SELECT * FROM users;",
      ];

      for (const query of bypassQueries) {
        const req = new Request("http://localhost:3002/api/query", {
          method: "POST",
          headers: {
            Cookie: "dev_session=authenticated_sunil_dev",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query }),
        });
        const response = await handleRequest(req);
        expect(response.status).toBe(403);
        const data = await response.json();
        expect(data.error).toContain("Security Violation");
      }
    });

    test("POST /api/query allows queries with keywords in comments", async () => {
      mockDbExecute.mockImplementation(async (sqlObj: any) => {
        return { rows: [{ count: 1 }], rowCount: 1 };
      });

      const safeQueries = [
        "SELECT 1; -- update users set name = 'hacked'",
        "SELECT 1; /* truncate table logs */",
      ];

      for (const query of safeQueries) {
        const req = new Request("http://localhost:3002/api/query", {
          method: "POST",
          headers: {
            Cookie: "dev_session=authenticated_sunil_dev",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query }),
        });
        const response = await handleRequest(req);
        expect(response.status).toBe(200);
      }
    });

    test("GET /api/diff blocks unauthorized path mappings (directory traversal / arbitrary files)", async () => {
      const traversalReq = new Request(
        "http://localhost:3002/api/diff?codePath=core/src/database&docPath=../../etc/passwd",
        {
          method: "GET",
          headers: { Cookie: "dev_session=authenticated_sunil_dev" },
        },
      );
      const response = await handleRequest(traversalReq);
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain("Path mapping is not authorized");
    });

    test("GET /api/diff allows valid mapped path parameters and invokes git safely", async () => {
      // Mock cp.spawnSync to return dummy output for diff
      const spawnSpy = spyOn(cp, "spawnSync").mockImplementation((cmd: any, args: any) => {
        return {
          stdout: "mock diff output",
          stderr: "",
          status: 0,
          signal: null,
          output: [],
        } as any;
      });

      try {
        const req = new Request(
          "http://localhost:3002/api/diff?codePath=core/src/database&docPath=docs/architecture/system.md",
          {
            method: "GET",
            headers: { Cookie: "dev_session=authenticated_sunil_dev" },
          },
        );
        const response = await handleRequest(req);
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.diff).toBe("mock diff output");
      } finally {
        spawnSpy.mockRestore();
      }
    });

    test("GET /api/status blocks session spoofing via substring matching in Cookies", async () => {
      const spoofedReq = new Request("http://localhost:3002/api/status", {
        method: "GET",
        headers: { Cookie: "other_key=dev_session=authenticated_sunil_dev" },
      });

      const response = await handleRequest(spoofedReq);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("Unauthorized");
    });

    test("GET /api/status allows authentication with exact cookie matching", async () => {
      let callCount = 0;
      mockDbExecute.mockImplementation(async (sqlObj: any) => {
        callCount++;
        if (callCount === 1) return { rows: [], rowCount: 0 }; // tables fetch
        if (callCount === 2) return { rows: [{ count: 0 }], rowCount: 1 }; // logs count
        return { rows: [], rowCount: 0 };
      });

      const validReq = new Request("http://localhost:3002/api/status", {
        method: "GET",
        headers: { Cookie: "dev_session=authenticated_sunil_dev; other_key=val" },
      });

      const response = await handleRequest(validReq);
      expect(response.status).toBe(200);
    });
  });
});
