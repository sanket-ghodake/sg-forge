import { db } from "@database/connection";
import { sql } from "drizzle-orm";

export async function runHealthCheck() {
  console.log("[HEALTH CHECK] Starting periodic health monitoring cycle...");

  try {
    // 1. Query all registered apps
    const appsResult = await db.execute(sql`
      SELECT id, name, slug, entry_url as "entryUrl", health_check_url as "healthCheckUrl"
      FROM forge_apps
    `);
    const apps = appsResult.rows || appsResult;

    for (const app of apps) {
      const appId = app.id as string;
      const appName = app.name as string;
      const slug = app.slug as string;
      const entryUrl = app.entryUrl as string;

      const isHttp =
        entryUrl && (entryUrl.startsWith("http://") || entryUrl.startsWith("https://"));

      let newStatus: "active" | "offline" | "degraded" = "offline";
      const start = Date.now();

      if (!isHttp) {
        newStatus = "active";
        console.log(
          `[HEALTH CHECK] App "${appName}" (${slug}) is a local/static component -> ACTIVE`,
        );
      } else {
        // Resolve health check url
        let resolvedEntryUrl = entryUrl;
        if (process.env.RUNNING_IN_DOCKER === "true") {
          resolvedEntryUrl = entryUrl.replace("localhost", slug).replace("127.0.0.1", slug);
        }
        const targetUrl = app.healthCheckUrl || resolvedEntryUrl.replace(/\/$/, "") + "/api/health";

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 seconds timeout

          const response = await (fetch as any)(targetUrl, {
            method: "GET",
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
          const duration = Date.now() - start;

          if (response.status === 200) {
            if (duration > 3000) {
              newStatus = "degraded";
              console.log(
                `[HEALTH CHECK] App "${appName}" (${slug}) response slow (${duration}ms) -> DEGRADED`,
              );
            } else {
              newStatus = "active";
              console.log(
                `[HEALTH CHECK] App "${appName}" (${slug}) responds in ${duration}ms -> ACTIVE`,
              );
            }
          } else {
            newStatus = "degraded";
            console.log(
              `[HEALTH CHECK] App "${appName}" (${slug}) status ${response.status} -> DEGRADED`,
            );
          }
        } catch (err: any) {
          newStatus = "offline";
          console.log(
            `[HEALTH CHECK] App "${appName}" (${slug}) connection failed: ${err.message} -> OFFLINE`,
          );
        }
      }

      // 2. Update status and last_seen timestamp in database
      await db.execute(sql`
        UPDATE forge_apps
        SET status = ${newStatus}, last_seen = NOW()
        WHERE id = ${appId}
      `);
    }

    console.log("[HEALTH CHECK] Health monitoring cycle completed.");
  } catch (error) {
    console.error("[HEALTH CHECK] Monitoring cycle failed:", error);
  }
}

// Support running directly or as a persistent daemon
if (import.meta.main) {
  const isDaemon = process.argv.includes("--daemon");
  if (isDaemon) {
    console.log("[HEALTH CHECK] Starting persistent health monitoring daemon...");
    while (true) {
      await runHealthCheck();
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  } else {
    runHealthCheck().then(() => process.exit(0));
  }
}
