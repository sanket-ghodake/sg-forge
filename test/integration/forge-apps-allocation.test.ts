import { describe, expect, test } from "bun:test";
import {
  getJobLevelByName,
  getMatchedAppsForUser,
  syncAppsToDatabase,
} from "@backend/api/user/portal";

describe("Forge App Resolution Security Engine Tests", () => {
  test("Should accurately match app availability based on target rule configurations", () => {
    const targetRules = { verticals: ["tech-dept-uuid"], minJobLevel: 2 };

    const validUser = { verticalId: "tech-dept-uuid", jobLevel: 3 };
    const invalidUser = { verticalId: "sales-dept-uuid", jobLevel: 4 };

    const checkRule = (user: typeof validUser) =>
      targetRules.verticals.includes(user.verticalId) && user.jobLevel >= targetRules.minJobLevel;

    expect(checkRule(validUser)).toBe(true);
    expect(checkRule(invalidUser)).toBe(false);
  });

  test("Should properly convert designations to numerical job levels", () => {
    expect(getJobLevelByName("CEO")).toBe(5);
    expect(getJobLevelByName("VP of Engineering")).toBe(4);
    expect(getJobLevelByName("Engineering Manager")).toBe(3);
    expect(getJobLevelByName("Senior Engineer")).toBe(2);
    expect(getJobLevelByName("Software Engineer")).toBe(1);
    expect(getJobLevelByName("Staff Member")).toBe(1);
  });

  test("Should match apps correctly based on user designations and verticals", async () => {
    await syncAppsToDatabase();

    const user = {
      id: "test-user-id",
      verticalId: "10000000-0000-0000-0000-000000000002", // Engineering
      designationId: "20000000-0000-0000-0000-000000000006", // Senior Engineer
      designation: "Senior Engineer",
    };

    const apps = await getMatchedAppsForUser("test-user-id", user);
    expect(apps).toBeDefined();

    const nexusApp = apps.find(
      (a) => a.slug === "nexus-provisioning" || a.id === "nexus-provisioning",
    );
    expect(nexusApp).toBeDefined();

    const jrUser = {
      id: "jr-user-id",
      verticalId: "10000000-0000-0000-0000-000000000002", // Engineering
      designationId: "20000000-0000-0000-0000-000000000007", // Software Engineer
      designation: "Software Engineer",
    };
    const jrApps = await getMatchedAppsForUser("jr-user-id", jrUser);
    const jrNexusApp = jrApps.find(
      (a) => a.slug === "nexus-provisioning" || a.id === "nexus-provisioning",
    );
    expect(jrNexusApp).toBeUndefined();
  });
});
