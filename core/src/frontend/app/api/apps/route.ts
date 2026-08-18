import { getSession } from "@backend/auth/sessionManager";
import { validateManifest } from "@backend/utils/manifestParser";
import { db } from "@database/connection";
import { sql } from "drizzle-orm";
import fs from "fs";
import { NextResponse } from "next/server";
import path from "path";

function getAppsDirectory(): string {
  let currentDir = process.cwd();
  while (currentDir) {
    const sandboxApps = path.join(currentDir, "sandbox/apps");
    if (fs.existsSync(sandboxApps)) {
      return sandboxApps;
    }
    const appsFolder = path.join(currentDir, "apps");
    if (fs.existsSync(appsFolder)) {
      return appsFolder;
    }
    const srcApps = path.join(currentDir, "src/apps");
    if (fs.existsSync(srcApps)) {
      return srcApps;
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }
  return path.join(process.cwd(), "sandbox/apps");
}

export async function GET() {
  try {
    const appsDir = getAppsDirectory();

    if (!fs.existsSync(appsDir)) {
      return NextResponse.json({ apps: [] });
    }

    // Retrieve database mappings to resolve database UUIDs (for lookup by UUID)
    const dbAppsResult = await db.execute(sql`
      SELECT id, slug FROM forge_apps
    `);
    const dbAppsRows = (dbAppsResult.rows || dbAppsResult) as any[];
    const dbAppsMap = new Map<string, string>();
    for (const row of dbAppsRows) {
      dbAppsMap.set(row.slug, row.id);
    }

    const items = fs.readdirSync(appsDir);
    const discoveredApps = [];

    for (const item of items) {
      const itemPath = path.join(appsDir, item);
      if (fs.statSync(itemPath).isDirectory()) {
        const configPath = path.join(itemPath, "app.json");
        if (fs.existsSync(configPath)) {
          try {
            const configContent = fs.readFileSync(configPath, "utf8");
            const config = JSON.parse(configContent);

            // Validate manifest
            const validation = validateManifest(config, item);
            if (validation.isValid) {
              const dbId = dbAppsMap.get(config.slug || config.id);
              discoveredApps.push({
                ...config,
                dbId: dbId || null,
                directoryName: item,
              });
            } else {
              console.warn(
                `[API APPS GET] Skipping invalid manifest in ${item}: ${validation.errors.join(", ")}`,
              );
            }
          } catch (err) {
            // nosemgrep: javascript.lang.security.audit.unsafe-formatstring.unsafe-formatstring
            console.error("Error parsing app config for %s:", item, err);
          }
        }
      }
    }

    return NextResponse.json({ apps: discoveredApps });
  } catch (error: any) {
    console.error("App discovery error:", error);
    return NextResponse.json({ error: "Failed to discover applications" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession(request as any);
    if (!session || (session.role !== "super_admin" && session.role !== "admin")) {
      return NextResponse.json(
        { error: "Unauthorized: Administrative privileges required" },
        { status: 401 },
      );
    }

    const manifest = await request.json();

    const id = manifest.id || manifest.slug;
    if (!id || typeof id !== "string" || !/^[a-zA-Z0-9_-]+$/.test(id)) {
      return NextResponse.json(
        {
          error:
            "Invalid app ID or slug format. Only alphanumeric characters, dashes, and underscores are allowed.",
        },
        { status: 400 },
      );
    }

    if (
      manifest.slug &&
      (typeof manifest.slug !== "string" || !/^[a-zA-Z0-9_-]+$/.test(manifest.slug))
    ) {
      return NextResponse.json(
        {
          error:
            "Manifest slug must be alphanumeric containing only letters, numbers, dashes, or underscores",
        },
        { status: 400 },
      );
    }

    // Validate using core validator
    const validation = validateManifest(manifest, id);
    if (!validation.isValid) {
      // Log validation failure in system logs
      try {
        await db.execute(sql`
          INSERT INTO system_logs (action, severity, payload)
          VALUES (
            'App Manifest Validation Failure (POST)',
            'WARN',
            ${JSON.stringify({ folderName: id, errors: validation.errors, manifest })}::jsonb
          )
        `);
      } catch (logErr) {
        console.error("Failed to log manifest validation error on POST:", logErr);
      }
      return NextResponse.json(
        { error: `Manifest validation failed: ${validation.errors.join(", ")}` },
        { status: 400 },
      );
    }

    const appsDir = getAppsDirectory();
    if (!fs.existsSync(appsDir)) {
      fs.mkdirSync(appsDir, { recursive: true });
    }

    // Sanitize path to prevent path traversal vulnerabilities
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    const appFolder = path.join(appsDir, path.basename(id));
    if (!fs.existsSync(appFolder)) {
      fs.mkdirSync(appFolder, { recursive: true });
    }

    fs.writeFileSync(
      // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
      path.join(appFolder, "app.json"),
      JSON.stringify(manifest, null, 2),
      "utf8",
    );

    // Trigger database sync
    const { parseAndRegisterManifests } = await import("@backend/utils/manifestParser");
    await parseAndRegisterManifests();

    return NextResponse.json({
      success: true,
      message: `Manifest registered successfully under ${id}`,
    });
  } catch (error: any) {
    console.error("Manifest upload error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to upload manifest" },
      { status: 500 },
    );
  }
}
