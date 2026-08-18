import { describe, expect, test } from "bun:test";
import { parseDbTimestamp } from "@backend/utils/date";

describe("Database Timestamp Parser Utility", () => {
  test("Should return Date object with equivalent UTC value if input is a Date object", () => {
    const originalDate = new Date();
    const parsed = parseDbTimestamp(originalDate);
    expect(parsed.toISOString()).toBe(
      new Date(
        Date.UTC(
          originalDate.getFullYear(),
          originalDate.getMonth(),
          originalDate.getDate(),
          originalDate.getHours(),
          originalDate.getMinutes(),
          originalDate.getSeconds(),
          originalDate.getMilliseconds(),
        ),
      ).toISOString(),
    );
  });

  test("Should parse timezone-less SQL timestamp strings as UTC", () => {
    // "2026-06-17 01:34:14.877" is parsed strictly as UTC (2026-06-17T01:34:14.877Z)
    const sqlString = "2026-06-17 01:34:14.877";
    const parsed = parseDbTimestamp(sqlString);

    expect(parsed.getUTCFullYear()).toBe(2026);
    expect(parsed.getUTCMonth()).toBe(5); // June is 5 (0-indexed)
    expect(parsed.getUTCDate()).toBe(17);
    expect(parsed.getUTCHours()).toBe(1);
    expect(parsed.getUTCMinutes()).toBe(34);
    expect(parsed.getUTCSeconds()).toBe(14);
    expect(parsed.getUTCMilliseconds()).toBe(877);
  });

  test("Should parse T-separated timezone-less strings as UTC", () => {
    const tString = "2026-06-17T01:34:14.877";
    const parsed = parseDbTimestamp(tString);
    expect(parsed.toISOString()).toBe("2026-06-17T01:34:14.877Z");
  });

  test("Should parse Z-terminated ISO strings as UTC", () => {
    const isoString = "2026-06-17T01:34:14.877Z";
    const parsed = parseDbTimestamp(isoString);
    expect(parsed.toISOString()).toBe("2026-06-17T01:34:14.877Z");
  });

  test("Should parse timezone-offset strings according to offset", () => {
    const offsetString = "2026-06-17T07:04:14.877+05:30"; // equivalent to 2026-06-17T01:34:14.877Z
    const parsed = parseDbTimestamp(offsetString);
    expect(parsed.toISOString()).toBe("2026-06-17T01:34:14.877Z");
  });

  test("Should parse timezone-offset strings with negative offset", () => {
    const offsetString = "2026-06-16T17:34:14.877-08:00"; // equivalent to 2026-06-17T01:34:14.877Z
    const parsed = parseDbTimestamp(offsetString);
    expect(parsed.toISOString()).toBe("2026-06-17T01:34:14.877Z");
  });
});
