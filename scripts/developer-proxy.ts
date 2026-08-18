// scripts/developer-proxy.ts
import { serve } from "bun";
import { Pool } from "pg";

const PORT = 3003;
const TARGET = process.env.PORTAL_URL || "http://localhost:3001";
const TARGET_WS = process.env.PORTAL_WS_URL || TARGET.replace(/^http/, "ws");

// Database connection pool helper
let dbPool: Pool | null = null;
function getDbPool(): Pool | null {
  if (dbPool) return dbPool;
  try {
    const connectionString =
      process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/org_db";
    dbPool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      keepAlive: true,
    });
    dbPool.on("error", (err) => {
      console.warn("[Proxy DB Pool] Warning: Unexpected idle client error:", err.message);
    });
    console.log("[Proxy DB] Initialized PostgreSQL connection pool successfully");
    return dbPool;
  } catch (err) {
    console.error("[Proxy DB] Pool initialization failed:", err);
    dbPool = null;
    return null;
  }
}

// Resolve App Slug from various possible markers
async function resolveAppSlug(req: Request): Promise<string> {
  const url = new URL(req.url);

  // 1. Path-based check (e.g., /api/forge-apps/:slug or /forge-apps/:slug)
  const pathParts = url.pathname.split("/");
  const forgeAppsIdx = pathParts.indexOf("forge-apps");
  if (forgeAppsIdx !== -1 && pathParts[forgeAppsIdx + 1]) {
    return pathParts[forgeAppsIdx + 1];
  }

  // Database-backed checks
  const client = getDbPool();
  if (client) {
    // 2. Authorization Bearer Token lookup
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7).trim();
      try {
        const res = await client.query(
          `SELECT a.slug 
           FROM forge_access_tokens t 
           JOIN forge_apps a ON t.app_id = a.id 
           WHERE t.access_token = $1 AND t.expires_at > NOW() 
           LIMIT 1`,
          [token],
        );
        if (res.rows.length > 0) {
          return res.rows[0].slug;
        }
      } catch (err) {
        console.error("[Proxy DB] Error resolving token to slug:", err);
      }
    }

    // 3. Referer/Origin check to match the sandbox container port
    const referer = req.headers.get("referer") || req.headers.get("origin") || "";
    if (referer) {
      try {
        const refUrl = new URL(referer);
        if (refUrl.port) {
          const portStr = `:${refUrl.port}`;
          const res = await client.query(
            `SELECT slug FROM forge_apps WHERE entry_url LIKE $2 OR redirect_uri LIKE $2 OR slug = $1 LIMIT 1`,
            [refUrl.hostname, `%${portStr}%`],
          );
          if (res.rows.length > 0) {
            return res.rows[0].slug;
          }
        }
      } catch (_e) {
        // ignore invalid url
      }
    }

    // 4. Client ID lookup inside body for OAuth flows
    if (
      req.method === "POST" &&
      (url.pathname.endsWith("/auth/exchange") || url.pathname.endsWith("/token"))
    ) {
      try {
        const reqClone = req.clone();
        const body = await reqClone.json();
        if (body?.client_id) {
          const res = await client.query(
            `SELECT slug FROM forge_apps WHERE client_id = $1 LIMIT 1`,
            [body.client_id],
          );
          if (res.rows.length > 0) {
            return res.rows[0].slug;
          }
        }
      } catch (_err) {
        // ignore parsing issues
      }
    }
  }

  // 5. Query parameters fallback
  const slugParam =
    url.searchParams.get("slug") ||
    url.searchParams.get("app_slug") ||
    url.searchParams.get("appSlug");
  if (slugParam) return slugParam;

  return "unknown";
}

// Sanitize query parameters to redact sensitive inputs like email/IDs/keys
function sanitizeUrl(urlString: string): string {
  try {
    const url = new URL(urlString, "http://localhost");
    const params = new URLSearchParams(url.search);
    let _updated = false;

    for (const [key, val] of params.entries()) {
      const isEmail = val.includes("@") && val.includes(".");
      const isUuid =
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(val);
      const isNumericId = /^\d+$/.test(val) && val.length > 2;
      const keyLower = key.toLowerCase();
      const isSensitiveKey =
        keyLower.includes("id") ||
        keyLower.includes("email") ||
        keyLower.includes("user") ||
        keyLower.includes("token") ||
        keyLower.includes("key") ||
        keyLower.includes("pass") ||
        keyLower.includes("secret") ||
        keyLower.includes("auth") ||
        keyLower.includes("code");

      if (isEmail || isUuid || isNumericId || isSensitiveKey) {
        params.set(key, "[REDACTED]");
        _updated = true;
      }
    }

    const queryStr = params.toString();
    return url.pathname + (queryStr ? `?${queryStr}` : "");
  } catch (_err) {
    return urlString;
  }
}

// SSE telemetry client connections map
const telemetryClients = new Map<number, ReadableStreamDefaultController>();

function broadcastTelemetryEvent(event: any) {
  const data = JSON.stringify(event);
  const packet = new TextEncoder().encode(`data: ${data}\n\n`);
  for (const [id, controller] of telemetryClients.entries()) {
    try {
      controller.enqueue(packet);
    } catch (_e) {
      telemetryClients.delete(id);
    }
  }
}

function renderProxyStatusHtml(status: number, title: string, message: string): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SG Forge Proxy // ${status} ${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --app-bg-root: #090d16;
      --app-bg-surface: rgba(17, 25, 40, 0.75);
      --app-bg-card: rgba(23, 33, 51, 0.85);
      --app-border: rgba(255, 255, 255, 0.1);
      --app-text-main: #f3f4f6;
      --app-text-muted: #9ca3af;
      --app-primary: #7c3aed;
      --app-accent: #2563eb;
      --app-danger: #ef4444;
      --app-header-bg: rgba(9, 13, 22, 0.8);
      --app-sidebar-bg: rgba(10, 15, 26, 0.95);
    }
    *, *::before, *::after { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 100vw;
      height: 100vh;
      background: radial-gradient(circle at center, #1e1b4b 0%, var(--app-bg-root) 80%);
      color: var(--app-text-main);
      font-family: 'Plus Jakarta Sans', sans-serif;
      overflow: hidden;
    }
    .app-container {
      display: flex;
      flex-direction: column;
      height: 100vh;
      width: 100vw;
    }
    .app-header {
      height: 60px;
      width: 100%;
      background: var(--app-header-bg);
      border-bottom: 1px solid var(--app-border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      flex-shrink: 0;
      z-index: 40;
    }
    .header-brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .logo-badge {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: 0.75rem;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    }
    .brand-title {
      font-weight: 800;
      font-size: 0.95rem;
      background: linear-gradient(90deg, #34d399, #60a5fa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .brand-subtitle {
      font-size: 0.65rem;
      color: var(--app-text-muted);
      font-family: 'JetBrains Mono', monospace;
    }
    .header-ports {
      display: flex;
      align-items: center;
      gap: 6px;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid var(--app-border);
      padding: 4px;
      border-radius: 10px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.75rem;
    }
    .port-link {
      padding: 4px 10px;
      border-radius: 6px;
      color: var(--app-text-muted);
      text-decoration: none;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .port-link:hover {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.08);
    }
    .port-link.active {
      background: rgba(16, 185, 129, 0.2);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.4);
      font-weight: 600;
    }
    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      display: inline-block;
    }
    .dot-indigo { background: #6366f1; }
    .dot-purple { background: #818cf8; }
    .dot-emerald { background: #34d399; }

    .content-row {
      display: flex;
      flex: 1;
      height: calc(100vh - 60px);
      width: 100%;
      min-height: 0;
      position: relative;
    }
    .sidebar-wrapper {
      position: relative;
      width: 4.5rem;
      height: 100%;
      flex-shrink: 0;
      z-index: 30;
    }
    .app-sidebar {
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      width: 4.5rem;
      background: var(--app-sidebar-bg);
      border-right: 1px solid var(--app-border);
      transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      flex-direction: column;
      padding: 16px 12px;
      gap: 10px;
      overflow: hidden;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
      border-radius: 0 16px 16px 0;
      z-index: 30;
    }
    .app-sidebar:hover {
      width: 16rem;
    }
    .sidebar-btn {
      width: 100%;
      height: 44px;
      border-radius: 12px;
      border: 1px solid transparent;
      background: transparent;
      color: var(--app-text-muted);
      display: flex;
      align-items: center;
      padding: 0 10px;
      cursor: pointer;
      text-decoration: none;
      transition: all 200ms ease;
      position: relative;
      box-sizing: border-box;
    }
    .sidebar-btn:hover {
      background: rgba(255, 255, 255, 0.05);
      color: #ffffff;
    }
    .sidebar-btn.active {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border-color: rgba(16, 185, 129, 0.3);
    }
    .active-indicator {
      position: absolute;
      left: 0;
      top: 25%;
      bottom: 25%;
      width: 4px;
      background: #34d399;
      border-radius: 0 4px 4px 0;
      box-shadow: 0 0 8px #34d399;
    }
    .icon-box {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .btn-label {
      margin-left: 12px;
      font-size: 0.875rem;
      font-weight: 700;
      white-space: nowrap;
      opacity: 0;
      transition: opacity 300ms ease;
    }
    .app-sidebar:hover .btn-label {
      opacity: 1;
    }
    .main-body {
      flex: 1;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      overflow-y: auto;
    }
    .proxy-card {
      width: 100%;
      max-width: 520px;
      padding: 32px;
      background: var(--app-bg-surface);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--app-border);
      border-radius: 16px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5), 0 0 40px rgba(16, 185, 129, 0.15);
      text-align: center;
      box-sizing: border-box;
      overflow-wrap: anywhere;
    }
    .status-badge {
      display: inline-block;
      padding: 6px 14px;
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: var(--app-danger);
      font-family: 'JetBrains Mono', monospace;
      font-weight: 600;
      font-size: 0.875rem;
      border-radius: 9999px;
      margin-bottom: 20px;
    }
    h1 { margin: 0 0 12px 0; font-size: 1.5rem; font-weight: 700; color: var(--app-text-main); }
    p { margin: 0 0 24px 0; font-size: 0.95rem; line-height: 1.6; color: var(--app-text-muted); }
    .actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
    .btn {
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .btn-primary {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #ffffff;
      border: none;
    }
    .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.05);
      color: var(--app-text-main);
      border: 1px solid var(--app-border);
    }
    .btn-secondary:hover { background: rgba(255, 255, 255, 0.1); }
  </style>
</head>
<body>
  <div class="app-container">
    <!-- Header -->
    <header class="app-header">
      <div class="header-brand">
        <div class="logo-badge">PX</div>
        <div>
          <div class="brand-title">SG Forge Developer Proxy</div>
          <div class="brand-subtitle">PORT 3003 // GATEWAY LAYER</div>
        </div>
      </div>

      <div class="header-ports">
        <a href="http://localhost:3001" class="port-link">
          <span class="dot dot-indigo"></span>:3001 Portal
        </a>
        <a href="http://localhost:3002" class="port-link">
          <span class="dot dot-purple"></span>:3002 DevCenter
        </a>
        <a href="http://localhost:3003/developer" class="port-link active">
          <span class="dot dot-emerald"></span>:3003 Proxy
        </a>
      </div>
    </header>

    <!-- Content Row: Floating Overlay Sidebar + Main Card -->
    <div class="content-row">
      <div class="sidebar-wrapper">
        <aside class="app-sidebar">
          <a href="http://localhost:3003/developer" class="sidebar-btn active" title="Developer Apps">
            <div class="active-indicator"></div>
            <div class="icon-box">
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
            </div>
            <span class="btn-label">Developer Apps</span>
          </a>
          <a href="http://localhost:3002" class="sidebar-btn" title="DevCenter Dashboard">
            <div class="icon-box">
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
            </div>
            <span class="btn-label">DevCenter</span>
          </a>
          <a href="http://localhost:3001" class="sidebar-btn" title="Main Application Portal">
            <div class="icon-box">
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
            </div>
            <span class="btn-label">Main Portal</span>
          </a>
        </aside>
      </div>

      <main class="main-body">
        <div class="proxy-card">
          <div class="status-badge">HTTP ${status} Gateway Error</div>
          <h1>${title}</h1>
          <p>${message}</p>
          <div class="actions">
            <button onclick="window.location.reload()" class="btn btn-primary">Retry Connection</button>
            <a href="http://localhost:3002/" class="btn btn-secondary">Open DevCenter</a>
          </div>
        </div>
      </main>
    </div>
  </div>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

serve<{ pathname: string; search: string; upstreamWs?: WebSocket }>({
  port: PORT,
  hostname: "0.0.0.0",
  async fetch(req, server) {
    const url = new URL(req.url);

    // 1. Expose CORS Preflight OPTIONS
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // 2. Expose the Telemetry Proxy SSE Stream locally
    if (req.method === "GET" && url.pathname === "/api/telemetry/proxy-stream") {
      if (server && typeof server.timeout === "function") {
        server.timeout(req, 0); // Disable connection idle timeout
      }
      const stream = new ReadableStream({
        start(controller) {
          const clientId = Date.now();
          telemetryClients.set(clientId, controller);

          const pingInterval = setInterval(() => {
            try {
              controller.enqueue(new TextEncoder().encode(": ping\n\n"));
            } catch (_e) {
              telemetryClients.delete(clientId);
              clearInterval(pingInterval);
            }
          }, 15000);

          req.signal.addEventListener("abort", () => {
            telemetryClients.delete(clientId);
            clearInterval(pingInterval);
          });
        },
        cancel() {
          // clean up
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "*",
        },
      });
    }

    // Handle WebSocket upgrade for Next.js HMR
    if (req.headers.get("upgrade") === "websocket") {
      const success = server.upgrade(req, {
        data: {
          pathname: url.pathname,
          search: url.search,
        },
      });
      if (success) return undefined;
    }

    let pathname = url.pathname;
    if (pathname === "/" || pathname === "") {
      pathname = "/developer";
    }

    const targetUrl = new URL(pathname + url.search, TARGET);

    // Clone request headers and update Host to target server
    const headers = new Headers(req.headers);
    const targetHost = new URL(TARGET).host;
    headers.set("host", targetHost);
    headers.set("x-from-developer-proxy", "true");

    const hasBody = !["GET", "HEAD"].includes(req.method) && req.body;

    // Measure request size (via content-length header or cloned body)
    let requestSize = parseInt(req.headers.get("content-length") || "0", 10);
    if (hasBody && requestSize === 0) {
      try {
        const reqClone = req.clone();
        const buf = await reqClone.arrayBuffer();
        requestSize = buf.byteLength;
      } catch (_e) {
        // ignore
      }
    }

    const start = Date.now();
    let appSlug = "unknown";
    const isApiRequest =
      (url.pathname.startsWith("/api/") || url.pathname.includes("/forge-apps/")) &&
      url.pathname !== "/api/telemetry/proxy-stream";

    if (isApiRequest) {
      try {
        appSlug = await resolveAppSlug(req);
      } catch (err) {
        console.error("Failed to resolve app slug:", err);
      }
    }

    try {
      const response = await fetch(targetUrl.toString(), {
        method: req.method,
        headers: headers,
        body: hasBody ? req.body : undefined,
        redirect: "manual",
      });

      // Forward response headers and status
      const resHeaders = new Headers(response.headers);
      resHeaders.delete("content-encoding");
      resHeaders.delete("content-length");
      resHeaders.delete("transfer-encoding");

      // Rewrite any absolute redirects pointing to port 3001 back to 3003
      let location = resHeaders.get("location");
      if (location) {
        if (location.includes("localhost:3001")) {
          location = location.replace("localhost:3001", `localhost:${PORT}`);
        }

        // If a redirect is trying to route the user to login, direct them back to developer
        const redirectUrl = new URL(location, `http://localhost:${PORT}`);
        if (redirectUrl.pathname === "/login" || redirectUrl.pathname === "/") {
          location = `http://localhost:${PORT}/developer`;
        }

        resHeaders.set("location", location);
      }

      // Read response body as buffer to count size and forward safely
      const resBody = await response.arrayBuffer();
      const responseSize = resBody.byteLength;
      const latencyMs = Date.now() - start;

      // Log telemetry if it's an API request
      if (isApiRequest) {
        const sanitizedRoute = sanitizeUrl(url.pathname + url.search);
        const telemetryEvent = {
          appSlug,
          endpointRoute: sanitizedRoute,
          httpMethod: req.method,
          statusCode: response.status,
          latencyMs,
          payloadSizeBytes: requestSize + responseSize,
          timestamp: Date.now(),
        };
        broadcastTelemetryEvent(telemetryEvent);
      }

      return new Response(resBody, {
        status: response.status,
        headers: resHeaders,
      });
    } catch (err) {
      console.error("[Proxy Error]:", err);
      const isJsonReq = req.headers.get("accept")?.includes("application/json");
      if (isJsonReq) {
        return new Response(
          JSON.stringify({
            error: "Proxy error connecting to upstream portal server",
            status: 502,
          }),
          {
            status: 502,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
      return renderProxyStatusHtml(
        502,
        "Upstream Portal Offline",
        "Unable to establish connection to the target server at port 3001. Please ensure the portal service is running.",
      );
    }
  },
  websocket: {
    open(ws) {
      const upstreamUrl = `${TARGET_WS}${ws.data.pathname}${ws.data.search}`;
      const upstreamWs = new WebSocket(upstreamUrl);
      ws.data.upstreamWs = upstreamWs;

      upstreamWs.onmessage = (event) => {
        if (ws.readyState === 1) {
          // OPEN
          ws.send(event.data);
        }
      };

      upstreamWs.onclose = () => {
        ws.close();
      };

      upstreamWs.onerror = (err) => {
        console.error("[Proxy Upstream WebSocket Error]:", err);
      };
    },
    message(ws, message) {
      if (ws.data.upstreamWs && ws.data.upstreamWs.readyState === 1) {
        ws.data.upstreamWs.send(message);
      }
    },
    close(ws) {
      if (ws.data.upstreamWs) {
        ws.data.upstreamWs.close();
      }
    },
  },
});

console.log(`Developer Proxy Server listening on port ${PORT} -> forwarding to ${TARGET}`);
