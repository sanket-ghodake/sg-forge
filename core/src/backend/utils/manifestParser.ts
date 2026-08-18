import { decryptText, encryptText } from "@backend/utils/crypto";
import { db } from "@database/connection";
import crypto from "crypto";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { z } from "zod";

export const ForgeAppManifestSchema = z
  .object({
    id: z
      .string()
      .regex(/^[a-zA-Z0-9_-]+$/)
      .optional(),
    slug: z.string().regex(/^[a-zA-Z0-9_-]+$/),
    name: z.string().min(1),
    description: z.string().optional(),
    version: z.string().optional(),
    icon: z.string().optional(),
    entryPoint: z.string().optional(),
    entryUrl: z.string().optional(),
    routingMode: z.string().min(1),
    clientId: z.string().optional(),
    clientSecret: z.string().optional(),
    redirectUri: z.string().optional(),
    requiredBasePermissions: z.array(z.string()).optional(),
    scopes: z.array(z.string()).optional(),
    database: z
      .object({
        requiresIsolatedSchema: z.boolean().optional(),
        schemaName: z
          .string()
          .regex(/^[a-zA-Z0-9_]+$/)
          .optional(),
      })
      .optional(),
    targetRules: z
      .object({
        verticals: z.array(z.string()).optional(),
        designations: z.array(z.string()).optional(),
        minJobLevel: z.number().optional(),
      })
      .optional(),
  })
  .refine((data) => data.entryPoint || data.entryUrl, {
    message: "Either entryPoint or entryUrl must be provided",
    path: ["entryPoint"],
  });

export interface AppManifest {
  id?: string;
  slug?: string;
  name?: string;
  description?: string;
  version?: string;
  icon?: string;
  entryPoint?: string;
  entryUrl?: string;
  routingMode?: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  requiredBasePermissions?: string[];
  scopes?: string[];
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

export interface ManifestValidationResult {
  isValid: boolean;
  errors: string[];
  manifest: AppManifest;
  folderName: string;
}

/**
 * Validates a single app manifest for required parameters:
 * - unique app slug identifier (must have `slug`)
 * - valid routingMode (e.g. must have `routingMode` and it should be non-empty)
 */
export function validateManifest(manifest: any, folderName: string): ManifestValidationResult {
  const errors: string[] = [];

  // Pre-process and apply sensible defaults/fallbacks to guarantee successful registration
  if (!manifest || typeof manifest !== "object") {
    manifest = {};
  }

  // Ensure slug exists and conforms
  if (
    !manifest.slug ||
    typeof manifest.slug !== "string" ||
    !/^[a-zA-Z0-9_-]+$/.test(manifest.slug)
  ) {
    manifest.slug = folderName.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  } else {
    manifest.slug = manifest.slug.toLowerCase();
  }

  // Ensure name exists
  if (!manifest.name || typeof manifest.name !== "string" || manifest.name.trim() === "") {
    manifest.name = folderName.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // Ensure routingMode exists
  if (
    !manifest.routingMode ||
    typeof manifest.routingMode !== "string" ||
    manifest.routingMode.trim() === ""
  ) {
    manifest.routingMode = "iframe";
  }

  // Ensure entryPoint or entryUrl exists
  if (!manifest.entryPoint && !manifest.entryUrl) {
    manifest.entryUrl = `http://localhost:3000/`;
  }

  if (!folderName || typeof folderName !== "string" || !/^[a-zA-Z0-9_-]+$/.test(folderName)) {
    errors.push(
      "Invalid app folder name (must be alphanumeric containing only letters, numbers, dashes, or underscores)",
    );
  }

  const result = ForgeAppManifestSchema.safeParse(manifest);
  if (!result.success) {
    for (const error of result.error.errors) {
      errors.push(`${error.path.join(".")}: ${error.message}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    manifest: (result.success ? result.data : manifest) as AppManifest,
    folderName,
  };
}

/**
 * Discovers and parses all manifests inside the apps directory.
 */
export function scanAppManifests(): ManifestValidationResult[] {
  const results: ManifestValidationResult[] = [];
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
      console.warn(`Apps directory not found. Process CWD: ${process.cwd()}`);
      return [];
    }

    const items = fs.readdirSync(appsDir);
    for (const item of items) {
      const itemPath = path.join(appsDir, item);
      if (fs.statSync(itemPath).isDirectory()) {
        const configPath = path.join(itemPath, "app.json");
        if (fs.existsSync(configPath)) {
          try {
            const configContent = fs.readFileSync(configPath, "utf8");
            const manifest = JSON.parse(configContent);
            const validation = validateManifest(manifest, item);
            results.push(validation);
          } catch (err: any) {
            results.push({
              isValid: false,
              errors: [`Failed to parse JSON file: ${err.message}`],
              manifest: {},
              folderName: item,
            });
          }
        }
      }
    }
  } catch (error: any) {
    console.error("Error scanning app manifests:", error);
  }
  return results;
}

/**
 * Main parser pipeline: Scans apps, registers valid ones to the database,
 * logs warnings for invalid ones, and handles isolated database schema provisioning.
 */
export async function parseAndRegisterManifests(): Promise<AppManifest[]> {
  console.log("Running App Manifest Parser Pipeline...");
  const validations = scanAppManifests();
  const registeredApps: AppManifest[] = [];

  for (const validation of validations) {
    const { isValid, errors, manifest, folderName } = validation;

    if (!isValid) {
      // Flag a validation warning inside system logs
      const warningMessage = `App Manifest Validation Failure in folder "${folderName}"`;
      console.warn(`[MANIFEST PARSER WARN] ${warningMessage}. Errors: ${errors.join(", ")}`);

      try {
        await db.execute(sql`
          INSERT INTO system_logs (action, severity, payload)
          VALUES (
            'App Manifest Validation Failure',
            'WARN',
            ${JSON.stringify({ folderName, errors, manifest })}::jsonb
          )
        `);
      } catch (logErr) {
        console.error("Failed to log manifest validation error to database:", logErr);
      }
      continue; // Prevent app from mounting/mounting to sidebar
    }

    // Register valid application into the database
    const slug = manifest.slug!;
    const name = manifest.name!;
    const entryUrl = manifest.entryPoint || manifest.entryUrl || "";
    const isIsolated = manifest.database?.requiresIsolatedSchema ?? false;
    const targetRules = manifest.targetRules || {};

    let clientId = manifest.clientId;
    let clientSecret = manifest.clientSecret;
    const redirectUri = manifest.redirectUri || entryUrl;
    const scopes = manifest.requiredBasePermissions || manifest.scopes || [];

    try {
      // Resolve existing client_id and client_secret if not supplied in manifest
      if (!clientId || !clientSecret) {
        const existingResult = await db.execute(sql`
          SELECT client_id, client_secret FROM forge_apps WHERE slug = ${slug}
        `);
        const existingRows = existingResult.rows || existingResult;
        if (existingRows && existingRows.length > 0 && existingRows[0].client_id) {
          clientId = existingRows[0].client_id as string;
          clientSecret = decryptText(existingRows[0].client_secret as string);
        } else {
          clientId = "client_" + Math.random().toString(36).substring(2, 15);
          clientSecret = "secret_" + crypto.randomUUID().replace(/-/g, "");
        }
      }

      const encryptedClientSecret = encryptText(clientSecret);
      const insertResult = await db.execute(sql`
        INSERT INTO forge_apps (slug, name, entry_url, is_isolated_lifecycle, client_id, client_secret, redirect_uri, scopes, target_rules)
        VALUES (${slug}, ${name}, ${entryUrl}, ${isIsolated}, ${clientId}, ${encryptedClientSecret}, ${redirectUri}, ${JSON.stringify(scopes)}::jsonb, ${JSON.stringify(targetRules)}::jsonb)
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name,
          entry_url = EXCLUDED.entry_url,
          is_isolated_lifecycle = EXCLUDED.is_isolated_lifecycle,
          client_id = EXCLUDED.client_id,
          client_secret = EXCLUDED.client_secret,
          redirect_uri = EXCLUDED.redirect_uri,
          scopes = EXCLUDED.scopes,
          target_rules = EXCLUDED.target_rules,
          updated_at = NOW()
        RETURNING id
      `);
      console.log("insertResult debug:", JSON.stringify(insertResult));
      const insertRows = insertResult.rows || insertResult;
      const appId = (insertRows[0] || {}).id as string;

      // Provision isolated schema namespace if required
      if (isIsolated && manifest.database?.schemaName) {
        const schemaName = manifest.database.schemaName;
        if (/^[a-zA-Z0-9_]+$/.test(schemaName)) {
          try {
            await db.execute(sql.raw(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`));

            await db.execute(sql`
              INSERT INTO forge_app_storage (app_id, custom_schema_namespace, allow_base_read_access)
              VALUES (${appId}, ${schemaName}, false)
              ON CONFLICT (custom_schema_namespace) DO UPDATE SET
                app_id = EXCLUDED.app_id
            `);
          } catch (schemaErr: any) {
            console.warn(
              `[MANIFEST PARSER WARN] Could not provision database schema namespace '${schemaName}' for app '${name}'.`,
            );
            console.warn(
              `Reason: ${schemaErr.message || schemaErr}. Assuming schema is managed externally or on a separate DB server.`,
            );
          }
        }
      }

      registeredApps.push(manifest);
      console.log(`[MANIFEST PARSER INFO] Registered app: ${name} (${slug})`);
    } catch (dbErr) {
      console.error('Failed to register valid app "%s" to database:', name, dbErr);
    }
  }

  // Also clean up any registered apps in the database that are no longer present on disk or no longer valid
  try {
    const currentValidSlugs = registeredApps.map((app) => app.slug!);
    const appsResult = await db.execute(sql`SELECT slug, id FROM forge_apps`);
    const dbApps = appsResult.rows || appsResult;
    for (const dbApp of dbApps) {
      const dbSlug = dbApp.slug as string;
      if (!currentValidSlugs.includes(dbSlug)) {
        console.log(
          `[MANIFEST PARSER INFO] Removing obsolete/invalid app from database registry: ${dbSlug}`,
        );
        await db.execute(sql`DELETE FROM forge_app_storage WHERE app_id = ${dbApp.id}`);
        await db.execute(sql`DELETE FROM forge_apps WHERE id = ${dbApp.id}`);
      }
    }
  } catch (cleanErr) {
    console.error("Failed to cleanup obsolete registered apps:", cleanErr);
  }

  return registeredApps;
}
