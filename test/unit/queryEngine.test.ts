import { afterAll, describe, expect, spyOn, test } from "bun:test";
import { executeAdminQuery } from "@backend/api/admin/queryEngine";
import { db, roDb } from "@database/connection";

// Mock both db.execute and roDb.execute methods
const mockExecute = spyOn(db, "execute").mockImplementation(async (sqlObj: any) => {
  return { rows: [{ result: "mocked" }], rowCount: 1 };
});
const mockRoExecute = spyOn(roDb, "execute").mockImplementation(async (sqlObj: any) => {
  return { rows: [{ result: "mocked" }], rowCount: 1 };
});

afterAll(() => {
  mockExecute.mockRestore();
  mockRoExecute.mockRestore();
});

describe("Administrative Query Engine Sandbox", () => {
  test("Allows read-only admin to execute safe SELECT queries", async () => {
    mockRoExecute.mockClear();
    const result = await executeAdminQuery("SELECT * FROM users;", "read_only_admin");
    expect(result).toBeDefined();
    expect(mockRoExecute).toHaveBeenCalled();
  });

  test("Blocks read-only admin from executing destructive queries (DROP)", async () => {
    mockRoExecute.mockClear();
    expect(executeAdminQuery("DROP TABLE users;", "read_only_admin")).rejects.toThrow(
      "Privilege Violation: Read-only accounts cannot run destructive queries.",
    );
    expect(mockRoExecute).not.toHaveBeenCalled();
  });

  test("Blocks read-only admin from executing destructive queries (DELETE)", async () => {
    mockRoExecute.mockClear();
    expect(executeAdminQuery("DELETE FROM users WHERE id = 1;", "read_only_admin")).rejects.toThrow(
      "Privilege Violation: Read-only accounts cannot run destructive queries.",
    );
    expect(mockRoExecute).not.toHaveBeenCalled();
  });

  test("Blocks read-only admin from executing destructive queries (ALTER)", async () => {
    mockRoExecute.mockClear();
    expect(
      executeAdminQuery("ALTER TABLE users ADD COLUMN age INT;", "read_only_admin"),
    ).rejects.toThrow("Privilege Violation: Read-only accounts cannot run destructive queries.");
    expect(mockRoExecute).not.toHaveBeenCalled();
  });

  test("Allows super_admin to execute destructive queries (DROP)", async () => {
    mockRoExecute.mockClear();
    const result = await executeAdminQuery("DROP TABLE temp_logs;", "super_admin");
    expect(result).toBeDefined();
    expect(mockRoExecute).toHaveBeenCalled();
  });

  test("Allows super_admin to execute safe SELECT queries", async () => {
    mockRoExecute.mockClear();
    const result = await executeAdminQuery("SELECT name FROM structural_metadata;", "super_admin");
    expect(result).toBeDefined();
    expect(mockRoExecute).toHaveBeenCalled();
  });

  test("Allows read-only admin to execute query with destructive keyword in a string literal", async () => {
    mockRoExecute.mockClear();
    const result = await executeAdminQuery(
      "SELECT * FROM users WHERE status = 'delete';",
      "read_only_admin",
    );
    expect(result).toBeDefined();
    expect(mockRoExecute).toHaveBeenCalled();
  });

  test("Allows read-only admin to execute query with destructive keyword in a comment", async () => {
    mockRoExecute.mockClear();
    const result = await executeAdminQuery(
      "SELECT * FROM users; -- delete the record",
      "read_only_admin",
    );
    expect(result).toBeDefined();
    expect(mockRoExecute).toHaveBeenCalled();
  });

  test("Blocks read-only admin from executing queries with hidden destructive keyword mixed with comments", async () => {
    mockRoExecute.mockClear();
    expect(
      executeAdminQuery(
        "SELECT * FROM users; DROP/* comment */ TABLE structural_metadata;",
        "read_only_admin",
      ),
    ).rejects.toThrow("Privilege Violation: Read-only accounts cannot run destructive queries.");
    expect(mockRoExecute).not.toHaveBeenCalled();
  });
});
