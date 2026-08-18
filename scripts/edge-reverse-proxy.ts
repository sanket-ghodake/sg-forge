/**
 * @file scripts/edge-reverse-proxy.ts
 * @description Central Edge Reverse Proxy Layer (Ports 80 & 443) for SG Forge.
 * Routes traffic to Portal (3001), DevCenter (3002), Gateway (3003), and Dynamic Sandbox Apps.
 * Automatically discovers newly added Forge apps in sandbox/apps without requiring proxy restart.
 */

import { serve } from "bun";
import fs from "fs";
import path from "path";
import { ensureSslCertificates } from "./generate-ssl";

// Core Service Target Definitions
const TARGETS = {
  PORTAL: process.env.PORTAL_URL || "http://localhost:3001",
  DEVCENTER: process.env.DEVCENTER_URL || "http://localhost:3002",
  GATEWAY: process.env.GATEWAY_URL || "http://localhost:3003",
};

export interface DiscoveredApp {
  slug: string;
  name: string;
  description: string;
  port: number;
  entryUrl: string;
  lang: string;
  icon: string;
  routingMode: string;
}

// In-memory dynamic application route registry
const appRegistry = new Map<string, DiscoveredApp>();
const APPS_DIR = path.resolve(process.cwd(), "sandbox/apps");

/**
 * Scans sandbox/apps directory and parses app.json manifests to populate the registry.
 */
export function scanAppManifests(): void {
  if (!fs.existsSync(APPS_DIR)) return;

  const entries = fs.readdirSync(APPS_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(APPS_DIR, entry.name, "app.json");
    if (!fs.existsSync(manifestPath)) continue;

    try {
      const content = fs.readFileSync(manifestPath, "utf8");
      const manifest = JSON.parse(content);
      const slug = manifest.slug || entry.name;
      const entryUrl = manifest.entryPoint || manifest.entryUrl || "";
      const portMatch = entryUrl.match(/:(\d+)/);
      const port = portMatch ? parseInt(portMatch[1], 10) : 0;
      const routingMode = manifest.routingMode || (port > 0 ? "iframe" : "react-component");

      // Detect language
      let lang = "TypeScript";
      if (fs.existsSync(path.join(APPS_DIR, entry.name, "main.go"))) lang = "Go";
      else if (
        fs.existsSync(path.join(APPS_DIR, entry.name, "server.py")) ||
        fs.existsSync(path.join(APPS_DIR, entry.name, "main.py"))
      )
        lang = "Python";

      appRegistry.set(slug, {
        slug,
        name: manifest.name || slug,
        description: manifest.description || "Dynamic SG Forge Micro-Frontend App",
        port,
        entryUrl:
          port > 0 ? `http://localhost:${port}/` : `http://localhost:3001/portal/apps/${slug}`,
        lang,
        icon: manifest.icon || "box",
        routingMode,
      });
    } catch (_err) {
      // Ignore transient filesystem parse errors during editing
    }
  }
}

/**
 * Initializes continuous directory watching for zero-config app additions.
 */
function watchAppDirectory(): void {
  if (!fs.existsSync(APPS_DIR)) return;
  fs.watch(APPS_DIR, { recursive: true }, (_event, filename) => {
    if (filename && filename.endsWith("app.json")) {
      setTimeout(() => scanAppManifests(), 300);
    }
  });
}

/**
 * Health check helper for an upstream HTTP service target.
 * @param url Target endpoint to probe
 * @returns boolean indicating if the target is healthy
 */
async function checkServiceHealth(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    return res.status < 500;
  } catch {
    return false;
  }
}

/**
 * Returns JSON status payload of all registered core and dynamic services.
 */
async function handleStatusApi(): Promise<Response> {
  const [portalOk, devOk, gatewayOk] = await Promise.all([
    checkServiceHealth(TARGETS.PORTAL),
    checkServiceHealth(TARGETS.DEVCENTER),
    checkServiceHealth(TARGETS.GATEWAY),
  ]);

  const isDocker = process.env.RUNNING_IN_DOCKER === "true";
  const appsStatus = await Promise.all(
    Array.from(appRegistry.values()).map(async (app) => {
      const probeUrl = isDocker ? `http://${app.slug}:${app.port}/` : app.entryUrl;
      return {
        ...app,
        online: await checkServiceHealth(probeUrl),
      };
    }),
  );

  return new Response(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      core: {
        portal: { url: TARGETS.PORTAL, online: portalOk, port: 3001 },
        devcenter: { url: TARGETS.DEVCENTER, online: devOk, port: 3002 },
        gateway: { url: TARGETS.GATEWAY, online: gatewayOk, port: 3003 },
      },
      apps: appsStatus,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
}

/**
 * Generates a sleek, dark-mode, encapsulated HTML Error Page.
 * Strictly conceals internal IPs, hostnames, ports, and raw system traces.
 */
function renderErrorPage(status: number, title: string, message: string): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${status} - ${title} | SG Forge</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --app-bg-root: #0b0f19;
      --app-bg-surface: #0f172a;
      --app-bg-card: #1e293b;
      --app-border: rgba(255, 255, 255, 0.1);
      --app-border-glow: rgba(99, 102, 241, 0.35);
      --app-text-main: #f8fafc;
      --app-text-muted: #94a3b8;
      --brand-indigo: #6366f1;
      --brand-amber: #f59e0b;
      --brand-rose: #f43f5e;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--app-bg-root);
      color: var(--app-text-main);
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      overflow-x: hidden;
    }
    .grid-bg {
      position: fixed; inset: 0;
      background-image: radial-gradient(circle at 50% 30%, rgba(244, 63, 94, 0.12) 0%, transparent 60%),
                        radial-gradient(circle at 80% 80%, rgba(99, 102, 241, 0.08) 0%, transparent 50%);
      pointer-events: none; z-index: 0;
    }
    .error-card {
      position: relative; z-index: 1;
      background: var(--app-bg-surface);
      border: 1px solid var(--app-border);
      border-radius: 20px;
      padding: 44px 36px;
      max-width: 520px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(12px);
    }
    .badge {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 5px 14px; border-radius: 9999px;
      background: rgba(244, 63, 94, 0.15); border: 1px solid rgba(244, 63, 94, 0.3);
      color: #fb7185; font-size: 12px; font-weight: 700; font-family: 'JetBrains Mono', monospace;
      letter-spacing: 0.5px; margin-bottom: 20px;
    }
    .icon-container {
      width: 64px; height: 64px; margin: 0 auto 20px auto;
      border-radius: 16px; background: rgba(244, 63, 94, 0.1);
      display: flex; align-items: center; justify-content: center;
      font-size: 28px; border: 1px solid rgba(244, 63, 94, 0.2);
    }
    h1 {
      font-size: 22px; font-weight: 800; margin-bottom: 12px;
      letter-spacing: -0.5px;
    }
    p {
      font-size: 14px; color: var(--app-text-muted); line-height: 1.6;
      margin-bottom: 28px;
    }
    .actions {
      display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;
    }
    .btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 8px;
      padding: 10px 20px; border-radius: 10px; font-size: 13px; font-weight: 600;
      text-decoration: none; cursor: pointer; transition: all 0.2s ease;
    }
    .btn-primary {
      background: var(--brand-indigo); color: #fff;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .btn-primary:hover { background: #4f46e5; }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.05); color: var(--app-text-main);
      border: 1px solid var(--app-border);
    }
    .btn-secondary:hover { background: rgba(255, 255, 255, 0.1); }
  </style>
</head>
<body>
  <div class="grid-bg"></div>
  <div class="error-card">
    <div class="badge">STATUS ${status} // SERVICE NOTICE</div>
    <div class="icon-container">🔌</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <div class="actions">
      <a href="/" class="btn btn-primary">← Return to Hub</a>
      <a href="/devcenter" class="btn btn-secondary">Open DevCenter</a>
      <a href="javascript:location.reload()" class="btn btn-secondary">Retry</a>
    </div>
  </div>
</body>
</html>`;

  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/**
 * Forwards an incoming HTTP request to an upstream target URL.
 */
async function forwardRequest(
  req: Request,
  targetBase: string,
  targetPath: string,
): Promise<Response> {
  const incomingUrl = new URL(req.url);
  const upstreamUrl = new URL(targetPath + incomingUrl.search, targetBase);

  const headers = new Headers(req.headers);
  headers.set("x-forwarded-host", incomingUrl.host);
  headers.set("x-forwarded-proto", incomingUrl.protocol.replace(":", ""));
  headers.set("x-forwarded-for", req.headers.get("x-forwarded-for") || "127.0.0.1");

  // Delete accept-encoding so upstream response isn't double-compressed / decoded mismatch
  headers.delete("accept-encoding");

  try {
    const body = ["GET", "HEAD"].includes(req.method) ? undefined : await req.arrayBuffer();
    const upstreamRes = await fetch(upstreamUrl.toString(), {
      method: req.method,
      headers,
      body,
      redirect: "manual",
    });

    const resHeaders = new Headers(upstreamRes.headers);
    // Strip compression and chunking headers because fetch automatically decompressed the payload
    resHeaders.delete("content-encoding");
    resHeaders.delete("content-length");
    resHeaders.delete("transfer-encoding");

    // Rewrite redirects if target redirects to its internal port or relative route
    let location = resHeaders.get("location");
    if (location) {
      location = location
        .replace(/http:\/\/localhost:3001/g, "")
        .replace(/http:\/\/app:3001/g, "")
        .replace(/http:\/\/localhost:3002/g, "/devcenter")
        .replace(/http:\/\/localhost:3003/g, "/gateway");
      resHeaders.set("location", location);
    }

    const contentType = resHeaders.get("content-type") || "";
    if (contentType.includes("text/event-stream") || contentType.includes("application/x-ndjson")) {
      resHeaders.set("Cache-Control", "no-cache, no-transform");
      resHeaders.set("Connection", "keep-alive");
      resHeaders.set("X-Accel-Buffering", "no");
      const { readable, writable } = new TransformStream();
      if (upstreamRes.body) {
        upstreamRes.body.pipeTo(writable).catch(() => {});
      }
      return new Response(readable, {
        status: upstreamRes.status,
        statusText: upstreamRes.statusText,
        headers: resHeaders,
      });
    }

    const resBuffer = await upstreamRes.arrayBuffer();
    return new Response(resBuffer, {
      status: upstreamRes.status,
      statusText: upstreamRes.statusText,
      headers: resHeaders,
    });
  } catch (_err: any) {
    const isHtml = (req.headers.get("accept") || "").includes("text/html");
    if (isHtml) {
      return renderErrorPage(
        502,
        "Service Temporarily Unavailable",
        "The requested backend service or microservice is currently offline or initializing. Infrastructure and internal configurations are protected.",
      );
    }
    return new Response(
      JSON.stringify({
        error: "Service Temporarily Unavailable",
        status: 502,
        timestamp: new Date().toISOString(),
      }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }
}

/**
 * Generates the rich modern HTML Landing Page showcasing the SG Forge Architecture & Portals.
 */
function renderLandingPage(): Response {
  const apps = Array.from(appRegistry.values());
  const appCardsHtml = apps
    .map(
      (app) => `
      <div class="app-card">
        <div class="app-header">
          <span class="app-badge ${app.lang.toLowerCase()}">${app.lang}</span>
          <span class="mode-tag">${app.routingMode === "react-component" ? "Portal Native" : "Sandboxed App"}</span>
        </div>
        <div class="app-title">${app.name}</div>
        <div class="app-desc">${app.description}</div>
        <div class="app-actions">
          <a href="${app.routingMode === "react-component" || app.port === 0 ? `/portal/apps/${app.slug}` : `/apps/${app.slug}/`}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-primary">Launch App &nearr;</a>
        </div>
      </div>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SG Forge - Modular Corporate Portal & Sandboxing Engine</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --app-bg-root: #0b0f19;
      --app-bg-surface: #0f172a;
      --app-bg-card: #1e293b;
      --app-bg-card-hover: #26354a;
      --app-border: rgba(255, 255, 255, 0.1);
      --app-border-glow: rgba(99, 102, 241, 0.35);
      --app-text-main: #f8fafc;
      --app-text-muted: #94a3b8;
      --brand-indigo: #6366f1;
      --brand-emerald: #10b981;
      --brand-purple: #a855f7;
      --brand-amber: #f59e0b;
      --brand-cyan: #06b6d4;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--app-bg-root);
      color: var(--app-text-main);
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      min-height: 100vh;
      overflow-x: hidden;
      line-height: 1.5;
    }
    .grid-bg {
      position: fixed; inset: 0;
      background-image: radial-gradient(circle at 50% 0%, rgba(99, 102, 241, 0.18) 0%, transparent 60%),
                        radial-gradient(circle at 100% 100%, rgba(16, 185, 129, 0.1) 0%, transparent 40%);
      pointer-events: none; z-index: 0;
    }
    .wrapper {
      position: relative; z-index: 1;
      max-width: 1280px; margin: 0 auto;
      padding: 32px 20px 64px 20px;
    }
    header {
      display: flex; justify-content: space-between; align-items: center;
      padding-bottom: 24px; border-bottom: 1px solid var(--app-border);
      flex-wrap: wrap; gap: 16px;
    }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand-icon {
      width: 42px; height: 42px; border-radius: 10px;
      background: linear-gradient(135deg, var(--brand-indigo), var(--brand-purple));
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 20px; color: #fff;
      box-shadow: 0 0 20px rgba(99, 102, 241, 0.4);
    }
    .brand-text h1 { font-size: 20px; font-weight: 800; letter-spacing: -0.5px; }
    .brand-text span { font-size: 12px; color: var(--app-text-muted); font-family: 'JetBrains Mono', monospace; }
    .status-pill {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 6px 14px; border-radius: 9999px;
      background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3);
      font-size: 13px; font-weight: 600; color: var(--brand-emerald);
    }
    .pulse-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: var(--brand-emerald); box-shadow: 0 0 10px var(--brand-emerald);
    }
    .hero {
      text-align: center; padding: 60px 16px 40px 16px;
    }
    .hero-badge {
      display: inline-block; padding: 6px 16px; border-radius: 9999px;
      background: rgba(99, 102, 241, 0.15); border: 1px solid var(--app-border-glow);
      color: #818cf8; font-size: 13px; font-weight: 600; margin-bottom: 20px;
      text-transform: uppercase; letter-spacing: 1px;
    }
    .hero h2 {
      font-size: clamp(28px, 5vw, 48px); font-weight: 800;
      letter-spacing: -1px; margin-bottom: 16px;
      background: linear-gradient(180deg, #ffffff 30%, #94a3b8 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .hero p {
      max-width: 720px; margin: 0 auto 32px auto;
      font-size: 16px; color: var(--app-text-muted);
    }
    .launch-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px; margin-bottom: 48px;
    }
    .launch-card {
      background: var(--app-bg-surface); border: 1px solid var(--app-border);
      border-radius: 14px; padding: 24px;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex; flex-direction: column; justify-content: space-between;
    }
    .launch-card:hover {
      border-color: var(--app-border-glow); transform: translateY(-3px);
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.4);
    }
    .card-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
    .card-icon {
      width: 44px; height: 44px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      font-size: 22px;
    }
    .icon-portal { background: rgba(99, 102, 241, 0.15); color: var(--brand-indigo); }
    .icon-dev { background: rgba(168, 85, 247, 0.15); color: var(--brand-purple); }
    .icon-gateway { background: rgba(16, 185, 129, 0.15); color: var(--brand-emerald); }
    .card-port {
      font-family: 'JetBrains Mono', monospace; font-size: 12px;
      background: rgba(255, 255, 255, 0.05); padding: 4px 10px;
      border-radius: 6px; color: var(--app-text-muted);
    }
    .card-title { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
    .card-desc { font-size: 14px; color: var(--app-text-muted); margin-bottom: 20px; }
    .btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 8px;
      padding: 10px 18px; border-radius: 8px; font-weight: 600; font-size: 14px;
      text-decoration: none; cursor: pointer; transition: all 0.2s ease;
    }
    .btn-primary { background: var(--brand-indigo); color: #fff; border: 1px solid rgba(255, 255, 255, 0.1); }
    .btn-primary:hover { background: #4f46e5; }
    .btn-secondary { background: rgba(255, 255, 255, 0.05); color: var(--app-text-main); border: 1px solid var(--app-border); }
    .btn-secondary:hover { background: rgba(255, 255, 255, 0.1); }
    .btn-sm { padding: 6px 12px; font-size: 12px; border-radius: 6px; }
    .section-title {
      font-size: 20px; font-weight: 700; margin-bottom: 20px;
      display: flex; align-items: center; justify-content: space-between;
    }
    .app-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 16px; margin-bottom: 48px;
    }
    .app-card {
      background: var(--app-bg-card); border: 1px solid var(--app-border);
      border-radius: 12px; padding: 20px; display: flex; flex-direction: column;
      justify-content: space-between; transition: all 0.2s ease;
    }
    .app-card:hover { background: var(--app-bg-card-hover); border-color: rgba(255, 255, 255, 0.2); }
    .app-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .app-badge { font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 3px 8px; border-radius: 4px; }
    .app-badge.typescript { background: rgba(99, 102, 241, 0.2); color: #818cf8; }
    .app-badge.go { background: rgba(6, 182, 212, 0.2); color: #22d3ee; }
    .app-badge.python { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }
    .port-tag { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--app-text-muted); }
    .app-title { font-size: 16px; font-weight: 700; margin-bottom: 6px; }
    .app-desc { font-size: 13px; color: var(--app-text-muted); margin-bottom: 16px; min-height: 38px; }
    .app-actions { display: flex; gap: 8px; }
    .feature-banner {
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.05));
      border: 1px solid var(--app-border-glow); border-radius: 16px;
      padding: 32px; margin-bottom: 48px;
    }
    .feature-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 24px; margin-top: 20px; }
    .feature-item h4 { font-size: 15px; font-weight: 700; margin-bottom: 6px; color: var(--app-text-main); }
    .feature-item p { font-size: 13px; color: var(--app-text-muted); }
    footer {
      text-align: center; font-size: 13px; color: var(--app-text-muted);
      padding-top: 24px; border-top: 1px solid var(--app-border);
      display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px;
    }
  </style>
</head>
<body>
  <div class="grid-bg"></div>
  <div class="wrapper">
    <header>
      <div class="brand">
        <div class="brand-icon">⚡</div>
        <div class="brand-text">
          <h1>SG FORGE</h1>
          <span>EDGE REVERSE PROXY // PORTS 80 & 443</span>
        </div>
      </div>
      <div class="status-pill">
        <div class="pulse-dot"></div>
        <span>Edge Proxy Active</span>
      </div>
    </header>

    <section class="hero">
      <div class="hero-badge">2026 Core Monolith OS & Sandboxing Engine</div>
      <h2>Unified Organizational Workspace</h2>
      <p>Seamlessly orchestrating Next.js 16 portals, real-time developer dashboards, and isolated polyglot microservices under zero-config reverse proxy routing.</p>
    </section>

    <div class="launch-grid">
      <!-- Portal -->
      <div class="launch-card">
        <div>
          <div class="card-head">
            <div class="card-icon icon-portal">🏢</div>
            <span class="card-port">Port :3001</span>
          </div>
          <div class="card-title">Main Portal & Canvas</div>
          <div class="card-desc">Interactive organization directory, reactive canvas, RBAC access control, and user profile management.</div>
        </div>
        <a href="/portal" target="_blank" rel="noopener noreferrer" class="btn btn-primary">Open Portal &nearr;</a>
      </div>

      <!-- DevCenter -->
      <div class="launch-card">
        <div>
          <div class="card-head">
            <div class="card-icon icon-dev">📊</div>
            <span class="card-port">Port :3002</span>
          </div>
          <div class="card-title">Developer Dashboard</div>
          <div class="card-desc">Real-time system telemetry, container metrics, database inspector, and micro-frontend orchestration center.</div>
        </div>
        <a href="/devcenter" target="_blank" rel="noopener noreferrer" class="btn btn-primary">Open DevCenter &nearr;</a>
      </div>

      <!-- Gateway -->
      <div class="launch-card">
        <div>
          <div class="card-head">
            <div class="card-icon icon-gateway">🛡️</div>
            <span class="card-port">Port :3003</span>
          </div>
          <div class="card-title">Developer Proxy Gateway</div>
          <div class="card-desc">Unified reverse proxy gateway, SSO token exchange, live event streams, and sandbox frame containment.</div>
        </div>
        <a href="/gateway" target="_blank" rel="noopener noreferrer" class="btn btn-primary">Open Gateway &nearr;</a>
      </div>
    </div>

    <div class="feature-banner">
      <h3 style="font-size: 18px; font-weight: 800;">⚡ Zero-Config Developer Experience</h3>
      <p style="font-size: 14px; color: var(--app-text-muted); margin-top: 4px;">Developers focus purely on building apps in <code>sandbox/apps/</code>. The Edge Reverse Proxy auto-detects manifests and maps routes instantly.</p>
      <div class="feature-grid">
        <div class="feature-item">
          <h4>🚀 1-Command Scaffold</h4>
          <p>Run <code>bun run create-app "App Name"</code> to generate isolated Go, Python, or TS services.</p>
        </div>
        <div class="feature-item">
          <h4>🛡️ Zero Host Install</h4>
          <p>Runs natively via isolated repo runtimes or multi-stage Docker containers.</p>
        </div>
        <div class="feature-item">
          <h4>🔄 Hot-Reloading & Live WS</h4>
          <p>Live HMR and real-time telemetry streams proxied with zero manual NGINX config.</p>
        </div>
        <div class="feature-item">
          <h4>🔒 Isolated Databases</h4>
          <p>PostgreSQL schema sandboxing and scoped role credentials per microservice.</p>
        </div>
      </div>
    </div>

    <div class="section-title">
      <span>Dynamic Microservices Catalog (${apps.length} Discovered)</span>
      <span style="font-size: 13px; color: var(--app-text-muted); font-family: 'JetBrains Mono', monospace;">Auto-Synced</span>
    </div>

    <div class="app-grid">
      ${appCardsHtml}
    </div>

    <footer>
      <div>SG Forge v0.1.0 &copy; 2026 Core Infrastructure Division</div>
      <div>Ports: 80 (HTTP) | 443 (HTTPS) | 3001 (Portal) | 3002 (DevCenter) | 3003 (Gateway)</div>
    </footer>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/**
 * Dispatches and routes incoming requests dynamically across core portals and microservices.
 */
async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const pathname = url.pathname;
  const isDocker = process.env.RUNNING_IN_DOCKER === "true";

  // 1. Landing Page Root
  if (pathname === "/" || pathname === "/index.html") {
    return renderLandingPage();
  }

  // 2. Health & Status APIs for Landing Hub
  if (pathname === "/api/landing/status") {
    return handleStatusApi();
  }

  // 3. DevCenter Dashboard Static Assets (/dashboard.js, /dashboard.css)
  if (
    pathname === "/dashboard.js" ||
    pathname === "/dashboard.css" ||
    pathname.endsWith("/dashboard.js") ||
    pathname.endsWith("/dashboard.css")
  ) {
    const assetPath = pathname.endsWith(".css") ? "/dashboard.css" : "/dashboard.js";
    return forwardRequest(req, TARGETS.DEVCENTER, assetPath);
  }

  // 4. DevCenter Route (/devcenter)
  if (pathname.startsWith("/devcenter")) {
    const targetPath = pathname.replace(/^\/devcenter/, "") || "/";
    return forwardRequest(req, TARGETS.DEVCENTER, targetPath);
  }

  // 5. Developer Gateway Route (/gateway, /developer)
  if (pathname.startsWith("/gateway") || pathname.startsWith("/developer")) {
    const targetPath = pathname.replace(/^\/gateway/, "") || "/";
    return forwardRequest(req, TARGETS.GATEWAY, targetPath);
  }

  // 6. Dynamic Sandbox Microservices (/apps/:slug/* or /forge-apps/:slug/*)
  const appMatch = pathname.match(/^\/(?:apps|forge-apps)\/([a-zA-Z0-9_-]+)(\/.*)?$/);
  if (appMatch) {
    const isDirectForgeRoute = pathname.startsWith("/forge-apps");
    const slug = appMatch[1];
    const subPath = appMatch[2] || "/";
    const registeredApp = appRegistry.get(slug);

    if (registeredApp) {
      if (
        !isDirectForgeRoute &&
        (registeredApp.routingMode === "react-component" ||
          registeredApp.routingMode === "local" ||
          registeredApp.port === 0)
      ) {
        return forwardRequest(req, TARGETS.PORTAL, pathname);
      }
      if (registeredApp.port > 0) {
        const upstreamBase = isDocker
          ? `http://${slug}:${registeredApp.port}`
          : registeredApp.entryUrl;
        return forwardRequest(req, upstreamBase, subPath);
      }
      return forwardRequest(req, TARGETS.PORTAL, pathname);
    } else {
      return renderErrorPage(
        404,
        "Application Not Found",
        `No application manifest was found matching "${slug}". Verify that an app.json manifest exists in sandbox/apps/.`,
      );
    }
  }

  // 7. Telemetry & Real-Time SSE Streams
  if (pathname.startsWith("/api/telemetry")) {
    const referer = req.headers.get("referer") || "";
    if (referer.includes("/gateway") || referer.includes(":3003")) {
      return forwardRequest(req, TARGETS.GATEWAY, pathname);
    }
    return forwardRequest(req, TARGETS.DEVCENTER, pathname);
  }

  // 8. Context-Aware API Routing (DevCenter vs Gateway vs Portal)
  if (pathname.startsWith("/api/")) {
    const referer = req.headers.get("referer") || "";
    if (referer.includes("/devcenter") || referer.includes(":3002")) {
      return forwardRequest(req, TARGETS.DEVCENTER, pathname);
    }
    if (
      referer.includes("/gateway") ||
      referer.includes("/developer") ||
      referer.includes(":3003")
    ) {
      return forwardRequest(req, TARGETS.GATEWAY, pathname);
    }
    return forwardRequest(req, TARGETS.PORTAL, pathname);
  }

  // 8. Main Portal Routes & Assets (/portal, /login, /user, /_next/*, /sdk/*, /favicon.ico)
  if (
    pathname.startsWith("/portal") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/user") ||
    pathname.startsWith("/force-reset") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/sdk/") ||
    pathname === "/favicon.ico"
  ) {
    const targetPath = pathname.replace(/^\/portal/, "") || "/";
    return forwardRequest(req, TARGETS.PORTAL, targetPath);
  }

  // Default: Render Landing Page for unknown top-level routes
  return renderLandingPage();
}

const TARGET_WS = process.env.PORTAL_WS_URL || TARGETS.PORTAL.replace(/^http/, "ws");

/**
 * Initializes and starts the HTTP and HTTPS edge reverse proxy servers with WebSocket support.
 */
export function startEdgeProxy(): void {
  // 1. Initial scan and directory watcher
  scanAppManifests();
  watchAppDirectory();

  // 2. Determine ports with graceful fallback
  const HTTP_PORT = process.env.PORT_HTTP ? parseInt(process.env.PORT_HTTP, 10) : 80;
  const HTTPS_PORT = process.env.PORT_HTTPS ? parseInt(process.env.PORT_HTTPS, 10) : 443;

  const websocketHandler = {
    open(ws: any) {
      const rawPath = ws.data.pathname || "";
      const cleanedPath = rawPath.replace(/^\/portal/, "") || "/";
      const search = ws.data.search || "";
      const upstreamUrl = `${TARGET_WS}${cleanedPath}${search}`;

      try {
        const upstreamWs = new WebSocket(upstreamUrl);
        ws.data.upstreamWs = upstreamWs;

        upstreamWs.onmessage = (event) => {
          if (ws.readyState === 1) {
            ws.send(event.data);
          }
        };
        upstreamWs.onclose = () => {
          try {
            ws.close();
          } catch {}
        };
        upstreamWs.onerror = (_err) => {
          try {
            ws.close();
          } catch {}
        };
      } catch (_err) {
        try {
          ws.close();
        } catch {}
      }
    },
    message(ws: any, message: any) {
      if (ws.data.upstreamWs && ws.data.upstreamWs.readyState === 1) {
        ws.data.upstreamWs.send(message);
      }
    },
    close(ws: any) {
      if (ws.data.upstreamWs) {
        try {
          ws.data.upstreamWs.close();
        } catch {}
      }
    },
  };

  const fetchWithWs = (req: Request, server: any) => {
    // Handle WebSocket upgrade for Next.js HMR & live streams
    if (req.headers.get("upgrade")?.toLowerCase() === "websocket") {
      const url = new URL(req.url);
      const success = server.upgrade(req, {
        data: {
          pathname: url.pathname,
          search: url.search,
        },
      });
      if (success) return undefined;
    }
    return handleRequest(req);
  };

  // 3. Start HTTP Server (Port 80 / 8080)
  try {
    serve<{ pathname: string; search: string; upstreamWs?: WebSocket }>({
      port: HTTP_PORT,
      hostname: "0.0.0.0",
      fetch: fetchWithWs,
      websocket: websocketHandler,
    });
    console.log(
      `[Edge Proxy] HTTP reverse proxy successfully listening on http://0.0.0.0:${HTTP_PORT}`,
    );
  } catch (err: any) {
    if (HTTP_PORT === 80) {
      console.warn(
        `[Edge Proxy] Port 80 requires privileged permission. Falling back to HTTP port 8080.`,
      );
      serve<{ pathname: string; search: string; upstreamWs?: WebSocket }>({
        port: 8080,
        hostname: "0.0.0.0",
        fetch: fetchWithWs,
        websocket: websocketHandler,
      });
      console.log(`[Edge Proxy] HTTP reverse proxy listening on http://localhost:8080`);
    } else {
      console.error(`[Edge Proxy] Failed to start HTTP server:`, err.message);
    }
  }

  // 4. Start HTTPS Server (Port 443 / 8443)
  try {
    const ssl = ensureSslCertificates();
    if (fs.existsSync(ssl.keyPath) && fs.existsSync(ssl.certPath)) {
      serve<{ pathname: string; search: string; upstreamWs?: WebSocket }>({
        port: HTTPS_PORT,
        hostname: "0.0.0.0",
        tls: {
          key: Bun.file(ssl.keyPath),
          cert: Bun.file(ssl.certPath),
        },
        fetch: fetchWithWs,
        websocket: websocketHandler,
      });
      console.log(
        `[Edge Proxy] HTTPS reverse proxy successfully listening on https://0.0.0.0:${HTTPS_PORT}`,
      );
    }
  } catch (err: any) {
    if (HTTPS_PORT === 443) {
      console.warn(
        `[Edge Proxy] Port 443 requires privileged permission. Falling back to HTTPS port 8443.`,
      );
      try {
        const ssl = ensureSslCertificates();
        serve<{ pathname: string; search: string; upstreamWs?: WebSocket }>({
          port: 8443,
          hostname: "0.0.0.0",
          tls: {
            key: Bun.file(ssl.keyPath),
            cert: Bun.file(ssl.certPath),
          },
          fetch: fetchWithWs,
          websocket: websocketHandler,
        });
        console.log(`[Edge Proxy] HTTPS reverse proxy listening on https://localhost:8443`);
      } catch (_e) {
        // Ignore secondary fallback
      }
    }
  }
}

// Start if executed directly
if (import.meta.main) {
  startEdgeProxy();
}
