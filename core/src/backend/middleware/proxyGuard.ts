import { hasAppAccess } from "@backend/auth/permissionEngine";

export function getJobLevelByName(name: string): number {
  const n = name.toLowerCase();
  if (n.includes("ceo")) return 5;
  if (n.includes("vp") || n.includes("cfo")) return 4;
  if (n.includes("manager")) return 3;
  if (n.includes("senior") || n.includes("sr")) return 2;
  return 1;
}

export async function validateAppAccess(
  userId: string,
  userRole: string,
  appSlug: string,
): Promise<boolean> {
  // If super_admin, permit access
  if (userRole === "super_admin") {
    return true;
  }

  return await hasAppAccess(userId, appSlug);
}
