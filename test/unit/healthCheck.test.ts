import { afterAll, afterEach, describe, expect, spyOn, test } from "bun:test";
import { runHealthCheck } from "@backend/workers/healthCheck";
import { db } from "@database/connection";

// Setup mocks for database execute
const mockDbExecute = spyOn(db, "execute").mockImplementation(async (sqlObj: any) => {
  return {
    rows: [],
    rowCount: 0,
  };
});

// Mock the global fetch
const mockFetch = spyOn(global, "fetch").mockImplementation(async (input: any, init?: any) => {
  return new Response("OK", { status: 200 });
});

afterEach(() => {
  mockDbExecute.mockClear();
  mockFetch.mockClear();
});

afterAll(() => {
  mockDbExecute.mockRestore();
  mockFetch.mockRestore();
});

describe("SG Forge Health Check Worker Pipeline", () => {
  test("runHealthCheck correctly updates local static apps vs HTTP services", async () => {
    // Mock 10 apps in the database registry
    const mockApps = [
      {
        id: "1",
        name: "Manager Ops",
        slug: "manager-operations",
        entryUrl: "manager-operations",
        healthCheckUrl: null,
      },
      {
        id: "2",
        name: "Expenses Tracker",
        slug: "reference-expenses",
        entryUrl: "http://localhost:8085/",
        healthCheckUrl: null,
      },
    ];

    let selectCount = 0;
    const dbUpdates: { id: string; status: string }[] = [];

    mockDbExecute.mockImplementation(async (sqlObj: any) => {
      const sqlStr = JSON.stringify(sqlObj) || "";

      if (
        sqlStr.includes("SELECT id, name") ||
        sqlStr.includes("SELECT id, name, slug, entry_url")
      ) {
        selectCount++;
        return { rows: mockApps, rowCount: mockApps.length };
      }

      if (sqlStr.includes("UPDATE forge_apps")) {
        // Drizzle SQL parameters are stored as strings in queryChunks between chunk objects
        const params: any[] = [];
        if (sqlObj.queryChunks) {
          for (const chunk of sqlObj.queryChunks) {
            if (typeof chunk === "string") {
              params.push(chunk);
            }
          }
        }

        // Params order: status, id
        const status = params[0] || "";
        const id = params[1] || "";
        dbUpdates.push({ id, status });
        return { rows: [], rowCount: 1 };
      }

      return { rows: [], rowCount: 0 };
    });

    await runHealthCheck();

    // Verify SELECT query was executed
    expect(selectCount).toBe(1);

    // Verify DB updates were saved
    expect(dbUpdates.length).toBe(2);

    // manager-operations (id 1) is a local React app -> should be ACTIVE without calling fetch
    const managerOpsUpdate = dbUpdates.find((u) => u.id === "1");
    expect(managerOpsUpdate).toBeDefined();
    expect(managerOpsUpdate?.status).toBe("active");

    // reference-expenses (id 2) is HTTP service -> calls fetch
    const expensesUpdate = dbUpdates.find((u) => u.id === "2");
    expect(expensesUpdate).toBeDefined();
    expect(expensesUpdate?.status).toBe("active");
    expect(mockFetch.mock.calls.length).toBe(1);
    expect(mockFetch.mock.calls[0][0]).toContain("http://localhost:8085/api/health");
  });
});
