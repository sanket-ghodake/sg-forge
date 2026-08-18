import { hasAppAccess } from "@backend/auth/permissionEngine";
import { parseAndRegisterManifests, validateManifest } from "@backend/utils/manifestParser";
import { db } from "@database/connection";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

export interface AppConfig {
  id: string;
  slug?: string;
  name: string;
  description: string;
  icon: string;
  roles?: string[];
  entryPoint: string;
  entryUrl?: string;
  directoryName: string;
  routingMode?: string;
  database?: {
    requiresIsolatedSchema?: boolean;
    schemaName?: string;
  };
  targetRules?: {
    verticals?: string[];
    designations?: string[];
    minJobLevel?: number;
  };
}

// Dynamically locate and scan `/src/apps` for applications registry
export function getDiscoveredApps(): AppConfig[] {
  try {
    let appsDir = "";
    let currentDir = process.cwd();
    while (currentDir) {
      const sandboxApps = path.join(currentDir, "sandbox/apps");
      const appsFolder = path.join(currentDir, "apps");
      const srcApps = path.join(currentDir, "src/apps");
      if (fs.existsSync(sandboxApps)) {
        appsDir = sandboxApps;
        break;
      }
      if (fs.existsSync(appsFolder)) {
        appsDir = appsFolder;
        break;
      }
      if (fs.existsSync(srcApps)) {
        appsDir = srcApps;
        break;
      }
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) {
        break;
      }
      currentDir = parentDir;
    }

    if (!appsDir || !fs.existsSync(appsDir)) {
      return [];
    }

    const items = fs.readdirSync(appsDir);
    const discoveredApps: AppConfig[] = [];

    for (const item of items) {
      const itemPath = path.join(appsDir, item);
      if (fs.statSync(itemPath).isDirectory()) {
        const configPath = path.join(itemPath, "app.json");
        if (fs.existsSync(configPath)) {
          try {
            const configContent = fs.readFileSync(configPath, "utf8");
            const config = JSON.parse(configContent);

            const validation = validateManifest(config, item);
            if (validation.isValid) {
              discoveredApps.push({
                ...config,
                directoryName: item,
              });
            }
          } catch (err) {
            console.error(`Error parsing app config for ${item}:`, err);
          }
        }
      }
    }
    return discoveredApps;
  } catch (error) {
    console.error("App discovery error:", error);
    return [];
  }
}

export function getJobLevelByName(name: string): number {
  const n = name.toLowerCase();
  if (n.includes("ceo")) return 5;
  if (n.includes("vp") || n.includes("cfo")) return 4;
  if (n.includes("manager")) return 3;
  if (n.includes("senior") || n.includes("sr")) return 2;
  return 1;
}

export async function syncAppsToDatabase() {
  await parseAndRegisterManifests();
}

export async function getMatchedAppsForUser(userId: string, user: any): Promise<AppConfig[]> {
  const discovered = getDiscoveredApps();
  const appsResult = await db.execute(sql`
    SELECT id, slug, name, entry_url as "entryUrl", target_rules as "targetRules" FROM forge_apps WHERE is_enabled = true
  `);
  const appsRows = appsResult.rows || appsResult;
  const matchedApps: AppConfig[] = [];

  for (const appRow of appsRows) {
    const slug = appRow.slug as string;
    const appId = appRow.id as string;

    const hasAccess = await hasAppAccess(userId, appId, user);
    if (!hasAccess) continue;

    const diskApp = discovered.find(
      (a) => (a.slug?.toLowerCase() || a.id?.toLowerCase()) === slug.toLowerCase(),
    );
    if (!diskApp) continue;

    const rules = (appRow.targetRules || diskApp.targetRules || {}) as any;

    matchedApps.push({
      id: diskApp.id,
      slug: diskApp.slug || slug,
      name: diskApp.name,
      description: diskApp.description || "",
      icon: diskApp.icon || "Cpu",
      roles: diskApp.roles || [],
      entryPoint: diskApp.entryPoint || diskApp.entryUrl || appRow.entryUrl || "",
      directoryName: diskApp.directoryName || slug,
      entryUrl: appRow.entryUrl || diskApp.entryUrl || diskApp.entryPoint || "",
      ...({
        routingMode: diskApp.routingMode || "iframe",
        targetRules: rules,
      } as any),
    });
  }

  return matchedApps;
}
