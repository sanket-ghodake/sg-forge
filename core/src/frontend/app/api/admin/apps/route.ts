import { getSession } from "@backend/auth/sessionManager";
import { decryptText } from "@backend/utils/crypto";
import { logEvent } from "@backend/utils/logger";
import { parseAndRegisterManifests } from "@backend/utils/manifestParser";
import { db } from "@database/connection";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

// GET: List all registered applications in database
export async function GET(request: Request) {
  try {
    const session = await getSession(request as any);
    if (!session || (session.role !== "super_admin" && session.role !== "admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let query;
    if (session.role === "super_admin") {
      query = sql`
        SELECT a.id, a.slug, a.name, a.entry_url as "entryUrl", a.is_enabled as "isEnabled",
               a.status, a.last_seen as "lastSeen", a.health_check_url as "healthCheckUrl",
               a.is_isolated_lifecycle as "isIsolatedLifecycle", a.scopes, a.target_rules as "targetRules",
               a.client_id as "clientId", a.client_secret as "clientSecret",
               s.custom_schema_namespace as "schemaName"
        FROM forge_apps a
        LEFT JOIN forge_app_storage s ON a.id = s.app_id
        ORDER BY a.name ASC
      `;
    } else {
      query = sql`
        SELECT a.id, a.slug, a.name, a.entry_url as "entryUrl", a.is_enabled as "isEnabled",
               a.status, a.last_seen as "lastSeen", a.health_check_url as "healthCheckUrl",
               a.is_isolated_lifecycle as "isIsolatedLifecycle", a.scopes, a.target_rules as "targetRules",
               a.client_id as "clientId", a.client_secret as "clientSecret",
               s.custom_schema_namespace as "schemaName"
        FROM forge_apps a
        INNER JOIN forge_app_admins adm ON a.id = adm.app_id
        LEFT JOIN forge_app_storage s ON a.id = s.app_id
        WHERE adm.user_id = ${session.id}
        ORDER BY a.name ASC
      `;
    }

    const res = await db.execute(query);
    const rawApps = res.rows || res;
    const apps = rawApps.map((app: any) => ({
      ...app,
      clientSecret: decryptText(app.clientSecret as string),
    }));
    return NextResponse.json({ apps });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Manage app state (Toggle Enable/Disable, Remove, Install/Scan)
export async function POST(request: Request) {
  const ipAddress =
    request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "127.0.0.1";

  try {
    const session = await getSession(request as any);
    if (!session || (session.role !== "super_admin" && session.role !== "admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, appId, slug, isEnabled } = body;

    // 1. Toggle Enabled Status
    if (action === "toggle") {
      if (!appId) return NextResponse.json({ error: "Missing appId" }, { status: 400 });

      await db.execute(sql`
        UPDATE forge_apps
        SET is_enabled = ${isEnabled}, updated_at = NOW()
        WHERE id = ${appId}
      `);

      await logEvent(
        session.id,
        isEnabled ? "App Enabled" : "App Disabled",
        "WARN",
        { appId },
        ipAddress,
      );
      return NextResponse.json({ success: true });
    }

    // 2. Remove Application
    if (action === "remove") {
      if (!appId) return NextResponse.json({ error: "Missing appId" }, { status: 400 });

      // Fetch storage schema details to drop if isolated
      const storageRes = await db.execute(sql`
        SELECT custom_schema_namespace FROM forge_app_storage WHERE app_id = ${appId}
      `);
      const storageRows = storageRes.rows || storageRes;

      if (storageRows && storageRows.length > 0) {
        const schemaName = storageRows[0].custom_schema_namespace as string;
        if (/^[a-zA-Z0-9_]+$/.test(schemaName)) {
          console.log(`[Lifecycle] Dropping schema ${schemaName} for app ${appId}`);
          await db.execute(sql.raw(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`));
        }
      }

      // Delete references and registry entry
      await db.execute(sql`DELETE FROM forge_app_storage WHERE app_id = ${appId}`);
      await db.execute(sql`DELETE FROM forge_access_tokens WHERE app_id = ${appId}`);
      await db.execute(sql`DELETE FROM forge_auth_codes WHERE app_id = ${appId}`);
      await db.execute(sql`DELETE FROM forge_apps WHERE id = ${appId}`);

      await logEvent(session.id, "App Removed", "CRITICAL", { appId }, ipAddress);
      return NextResponse.json({ success: true });
    }

    // 3. Re-scan & Sync / Install local apps
    if (action === "install" || action === "scan") {
      const manifests = await parseAndRegisterManifests();
      await logEvent(
        session.id,
        "Apps Scanned and Synced",
        "INFO",
        { count: manifests.length },
        ipAddress,
      );
      return NextResponse.json({ success: true, count: manifests.length });
    }

    // 4. Rotate Client Secret
    if (action === "rotate_secret") {
      if (!appId) return NextResponse.json({ error: "Missing appId" }, { status: 400 });

      const crypto = await import("crypto");
      const { encryptText } = await import("@backend/utils/crypto");
      const newSecret = "secret_" + crypto.randomUUID().replace(/-/g, "");
      const encryptedSecret = encryptText(newSecret);

      await db.execute(sql`
        UPDATE forge_apps
        SET client_secret = ${encryptedSecret}, updated_at = NOW()
        WHERE id = ${appId}
      `);

      await logEvent(session.id, "App Secret Rotated", "INFO", { appId }, ipAddress);
      return NextResponse.json({ success: true, clientSecret: newSecret });
    }

    return NextResponse.json({ error: "Invalid action parameter" }, { status: 400 });
  } catch (err: any) {
    console.error("App management API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
