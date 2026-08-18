import fs from "node:fs";
import path from "node:path";
import { db } from "@database/connection";
import { sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

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

async function handleProxy(request: NextRequest, context: any) {
  const params = await context.params;
  const slug = params?.slug as string;
  const subpath = params?.path as string[] | undefined;

  // Retrieve app entryUrl from DB
  const appResult = await db.execute(
    sql`
    SELECT entry_url, is_enabled FROM forge_apps WHERE slug = ${slug}
  ` as any,
  );
  let rows = appResult.rows || appResult;

  if (rows && rows.length > 0 && !rows[0].is_enabled) {
    return new NextResponse("Application is disabled by system administrator", { status: 403 });
  }

  if (!rows || rows.length === 0) {
    // Fallback: If not found by slug directly (e.g. requested using the manifest ID),
    // resolve the actual database slug by checking local manifest files.
    try {
      const appsDir = getAppsDirectory();
      if (fs.existsSync(appsDir)) {
        const items = fs.readdirSync(appsDir);
        for (const item of items) {
          const configPath = path.join(appsDir, item, "app.json");
          if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
            if (config.id === slug || config.slug === slug || item === slug) {
              const dbSlug = config.slug;
              const dbResult = await db.execute(
                sql`
                SELECT entry_url FROM forge_apps WHERE slug = ${dbSlug}
              ` as any,
              );
              const dbRows = dbResult.rows || dbResult;
              if (dbRows && dbRows.length > 0) {
                rows = dbRows;
                break;
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("Failed to resolve app slug from local manifest:", err);
    }
  }

  if (!rows || rows.length === 0) {
    return new NextResponse("Application not found", { status: 404 });
  }

  let entryUrl = rows[0].entry_url as string;
  if (process.env.RUNNING_IN_DOCKER === "true") {
    entryUrl = entryUrl.replace("localhost", slug).replace("127.0.0.1", slug);
  }
  const pathStr = subpath ? subpath.join("/") : "";
  const queryStr = request.nextUrl.search;

  // Construct destination URL
  const targetUrlStr = entryUrl.endsWith("/") ? entryUrl : `${entryUrl}/`;
  const targetUrl = new URL(pathStr + queryStr, targetUrlStr).toString();

  try {
    const headers = new Headers();
    if (request.headers && typeof request.headers.entries === "function") {
      for (const [key, value] of request.headers.entries()) {
        if (!["host", "cookie", "connection", "origin", "referer"].includes(key.toLowerCase())) {
          headers.set(key, value);
        }
      }
    } else if (request.headers && typeof (request.headers as any).forEach === "function") {
      (request.headers as any).forEach((value: string, key: string) => {
        if (!["host", "cookie", "connection", "origin", "referer"].includes(key.toLowerCase())) {
          headers.set(key, value);
        }
      });
    } else if (request.headers) {
      for (const key of Object.keys(request.headers)) {
        if (!["host", "cookie", "connection", "origin", "referer"].includes(key.toLowerCase())) {
          headers.set(key, (request.headers as any)[key]);
        }
      }
    }

    const body =
      request.body && ["POST", "PUT", "PATCH"].includes(request.method)
        ? await request.arrayBuffer()
        : undefined;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout for Dev/Turbopack

    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
      signal: controller.signal,
      redirect: "manual",
    });

    clearTimeout(timeoutId);

    const responseHeaders = new Headers();
    if (response.headers && typeof response.headers.entries === "function") {
      for (const [key, value] of response.headers.entries()) {
        responseHeaders.set(key, value);
      }
    } else if (response.headers && typeof (response.headers as any).forEach === "function") {
      (response.headers as any).forEach((value: string, key: string) => {
        responseHeaders.set(key, value);
      });
    } else if (response.headers) {
      for (const key of Object.keys(response.headers)) {
        responseHeaders.set(key, (response.headers as any)[key]);
      }
    }

    const origin =
      request.headers && typeof request.headers.get === "function"
        ? request.headers.get("origin") || "*"
        : "*";
    responseHeaders.set("Access-Control-Allow-Origin", origin);

    const responseBody = await response.arrayBuffer();
    return new NextResponse(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error: any) {
    console.warn(
      `Proxy offline for ${slug} to ${targetUrl}. Handling proxy failure.`,
      error.message,
    );

    const isApi = pathStr.startsWith("api") || pathStr.includes("/api");
    if (isApi) {
      const origin = request.headers.get("origin") || "*";
      return NextResponse.json(
        {
          success: false,
          error: `Proxy request failed: ${error.message || "Gateway Timeout"}`,
        },
        {
          status: 504,
          headers: {
            "Access-Control-Allow-Origin": origin,
          },
        },
      );
    }

    // Resolve the manifest configuration to render mock details
    let config: any = {
      name: slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      slug: slug,
      description: "External extension module integrated via iFrame routing.",
      developer: "Unknown Developer",
      version: "1.0.0",
    };

    try {
      const configPath = path.join(getAppsDirectory(), slug, "app.json");
      if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      }
    } catch (err) {
      console.error("Error loading config for fallback UI:", err);
    }

    const fallbackHtml = `<!DOCTYPE html>
<html lang="en" data-theme="default">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.name} - Sandbox Mode</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    :root {
      --bg-primary: #0b0f19;
      --bg-card: #1e293b;
      --text-primary: #f8fafc;
      --text-secondary: #cbd5e1;
      --border: rgba(255,255,255,0.12);
      --accent: #6366f1;
      --warning: #fbbf24;
      --warning-bg: rgba(251, 191, 36, 0.1);
      --warning-border: rgba(251, 191, 36, 0.25);
      --warning-text: #fbbf24;
      --warning-muted: #f59e0b;
    }
    html[data-theme="light"] {
      --bg-primary: #f8fafc;
      --bg-card: #ffffff;
      --text-primary: #0f172a;
      --text-secondary: #475569;
      --border: #e2e8f0;
      --accent: #4f46e5;
      --warning: #d97706;
      --warning-bg: rgba(217, 119, 6, 0.05);
      --warning-border: rgba(217, 119, 6, 0.2);
      --warning-text: #9a3412;
      --warning-muted: #9a3412;
    }
    html[data-theme="dark"] {
      --bg-primary: #09090b;
      --bg-card: #18181b;
      --text-primary: #f4f4f5;
      --text-secondary: #a1a1aa;
      --border: #27272a;
      --accent: #818cf8;
      --warning: #fbbf24;
      --warning-bg: rgba(251, 191, 36, 0.1);
      --warning-border: rgba(251, 191, 36, 0.25);
      --warning-text: #fbbf24;
      --warning-muted: #f59e0b;
    }
    html[data-theme="solarized-dark"] {
      --bg-primary: #002b36;
      --bg-card: #073642;
      --text-primary: #fdf6e3;
      --text-secondary: #93a1a1;
      --border: #0b4554;
      --accent: #268bd2;
      --warning: #b58900;
      --warning-bg: rgba(181, 137, 0, 0.1);
      --warning-border: rgba(181, 137, 0, 0.25);
      --warning-text: #b58900;
      --warning-muted: #b58900;
    }
    html[data-theme="solarized-light"] {
      --bg-primary: #fdf6e3;
      --bg-card: #eee8d5;
      --text-primary: #073642;
      --text-secondary: #586e75;
      --border: #decda3;
      --accent: #268bd2;
      --warning: #b58900;
      --warning-bg: rgba(181, 137, 0, 0.05);
      --warning-border: rgba(181, 137, 0, 0.2);
      --warning-text: #7c5e00;
      --warning-muted: #7c5e00;
    }
    body {
      background-color: var(--bg-primary);
      color: var(--text-primary);
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      transition: all 0.2s ease;
    }
    .card {
      background-color: var(--bg-card);
      border: 1px solid var(--border);
    }
  </style>
</head>
<body class="p-6 min-h-screen">
  <!-- Top Banner -->
  <div class="mb-6 p-4 rounded-xl flex items-center justify-between" style="background-color: var(--warning-bg); border: 1px solid var(--warning-border);">
    <div class="flex items-center gap-3">
      <span class="text-xl">✨</span>
      <div>
        <h4 class="text-xs font-bold text-left" style="color: var(--warning-text);">Sandbox Preview Mode Active</h4>
        <p class="text-[10px] text-left" style="color: var(--warning-muted);">Direct connection to <code>${targetUrl}</code> timed out (offline). Serving simulated mock application layout.</p>
      </div>
    </div>
    <div class="text-[9px] font-mono px-2 py-0.5 rounded uppercase tracking-wider" style="background-color: var(--warning-border); color: var(--warning-text);">
      Local Fallback
    </div>
  </div>

  <!-- App Header -->
  <div class="flex items-start justify-between border-b pb-4 mb-6" style="border-color: var(--border)">
    <div class="text-left">
      <h1 class="text-xl font-bold flex items-center gap-2">
        <span>📦</span>
        <span>${config.name}</span>
      </h1>
      <p class="text-xs text-[var(--text-secondary)] mt-1 max-w-xl">${config.description}</p>
    </div>
    <div class="text-right">
      <div class="text-xs font-bold text-[var(--accent)]">${config.developer}</div>
      <div class="text-[10px] text-[var(--text-secondary)] mt-0.5">v${config.version} • Sandbox</div>
    </div>
  </div>

  <!-- Dashboard Grid -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
    <div class="card p-4 rounded-xl shadow-sm text-left">
      <div class="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-bold">Simulated Records</div>
      <div class="text-2xl font-bold mt-1" id="record-count">0</div>
    </div>
    <div class="card p-4 rounded-xl shadow-sm text-left">
      <div class="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-bold">System Status</div>
      <div class="text-2xl font-bold mt-1 text-emerald-500 flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <span>Simulated OK</span>
      </div>
    </div>
    <div class="card p-4 rounded-xl shadow-sm text-left">
      <div class="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-bold">Isolated Schema</div>
      <div class="text-xs font-mono mt-2 bg-black/10 px-2 py-1 rounded w-fit" style="color: var(--accent)">
        ${config.database?.schemaName || "none"}
      </div>
    </div>
  </div>

  <!-- Main Work area -->
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <!-- Form Panel -->
    <div class="card p-5 rounded-xl space-y-4 text-left">
      <h3 class="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Create Simulated Entry</h3>
      <form id="sandbox-form" class="space-y-3">
        <div>
          <label class="block text-[10px] font-bold uppercase mb-1 text-[var(--text-secondary)]">Label / Name</label>
          <input type="text" name="label" required class="w-full text-xs p-2 rounded-lg bg-black/20 border focus:outline-none focus:border-[var(--accent)] text-[var(--text-primary)]" style="border-color: var(--border)">
        </div>
        <div>
          <label class="block text-[10px] font-bold uppercase mb-1 text-[var(--text-secondary)]">Details / Description</label>
          <textarea name="details" rows="2" class="w-full text-xs p-2 rounded-lg bg-black/20 border focus:outline-none focus:border-[var(--accent)] text-[var(--text-primary)]" style="border-color: var(--border)"></textarea>
        </div>
        <div>
          <label class="block text-[10px] font-bold uppercase mb-1 text-[var(--text-secondary)]">Amount / Value</label>
          <input type="text" name="amount" placeholder="e.g. $125.00" class="w-full text-xs p-2 rounded-lg bg-black/20 border focus:outline-none focus:border-[var(--accent)] text-[var(--text-primary)]" style="border-color: var(--border)">
        </div>
        <button type="submit" class="w-full py-2 bg-[var(--accent)] hover:opacity-95 text-white font-bold rounded-lg text-xs transition-opacity mt-2">
          Add Simulated Record
        </button>
      </form>
    </div>

    <!-- Data Panel -->
    <div class="lg:col-span-2 card p-5 rounded-xl text-left">
      <h3 class="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-4">Simulated Ledger Content</h3>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="border-b text-[10px] uppercase font-bold text-[var(--text-secondary)]" style="border-color: var(--border)">
              <th class="pb-2">ID</th>
              <th class="pb-2">Label</th>
              <th class="pb-2">Details</th>
              <th class="pb-2">Amount</th>
              <th class="pb-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody id="ledger-body" class="divide-y divide-white/5" style="border-color: var(--border)">
            <!-- Dynamic rows here -->
          </tbody>
        </table>
        <div id="no-records" class="text-center py-8 text-[var(--text-secondary)] text-xs">
          No records simulated yet. Submit the form to add some!
        </div>
      </div>
    </div>
  </div>

  <script>
    // Theme handler from parent postMessage
    window.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'THEME_CHANGE') {
        document.documentElement.setAttribute('data-theme', e.data.theme);
      }
    });

    // Seed mock data
    const mockLedgers = {
      'apex-expenses': [
        { id: 'EXP-101', label: 'Q2 Cloud Infrastructure', details: 'AWS production server nodes subscription hosting fees', amount: '$4,120.00' },
        { id: 'EXP-102', label: 'Travel Reimbursement', details: 'Client meeting flights & business luncheon mileage', amount: '$540.25' },
        { id: 'EXP-103', label: 'Corporate Office Hardware Upgrade', details: 'Mechanical keyboards and ergonomic setup packages', amount: '$1,299.00' },
      ],
      'nexus-provisioning': [
        { id: 'PRV-401', label: 'Developer Laptop Allocation', details: 'MacBook Pro 16" M3 Max 64GB - Assigned to E0011', amount: 'Active' },
        { id: 'PRV-402', label: 'Office Monitor Supply', details: 'Dell UltraSharp 38" Curved Hub Monitor - Assigned to E0005', amount: 'Provisioned' },
        { id: 'PRV-403', label: 'IT Security Key Pack', details: 'Yubikey 5C NFC hardware multi-factor token keys', amount: 'Pending' },
      ]
    };

    const slug = '${config.slug}';
    let records = [...(mockLedgers[slug] || [
      { id: 'REC-001', label: 'Simulated Record A', details: 'Standard default sandbox mock record description', amount: 'Pending' },
      { id: 'REC-002', label: 'Simulated Record B', details: 'Another default mock ledger item value', amount: 'Active' }
    ])];

    const recordCountEl = document.getElementById('record-count');
    const ledgerBodyEl = document.getElementById('ledger-body');
    const noRecordsEl = document.getElementById('no-records');
    const formEl = document.getElementById('sandbox-form');

    function renderLedger() {
      ledgerBodyEl.innerHTML = '';
      recordCountEl.textContent = records.length;
      
      if (records.length === 0) {
        noRecordsEl.style.display = 'block';
        return;
      }
      noRecordsEl.style.display = 'none';

      records.forEach(rec => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-white/5 transition-colors';
        tr.innerHTML = \`
          <td class="py-2.5 font-mono text-[10px] text-[var(--accent)]">\${rec.id}</td>
          <td class="py-2.5 font-bold">\${rec.label}</td>
          <td class="py-2.5 text-[var(--text-secondary)]">\${rec.details}</td>
          <td class="py-2.5 font-mono">\${rec.amount}</td>
          <td class="py-2.5 text-right">
            <button onclick="deleteRecord('\${rec.id}')" class="text-red-400 hover:text-red-300 font-bold">Delete</button>
          </td>
        \`;
        ledgerBodyEl.appendChild(tr);
      });
    }

    window.deleteRecord = function(id) {
      records = records.filter(r => r.id !== id);
      renderLedger();
    };

    formEl.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(formEl);
      const label = formData.get('label');
      const details = formData.get('details');
      const amount = formData.get('amount') || 'N/A';
      
      const newRec = {
        id: 'SIM-' + Math.floor(100 + Math.random() * 900),
        label,
        details,
        amount
      };

      records.unshift(newRec);
      renderLedger();
      formEl.reset();
    });

    renderLedger();
  </script>
</body>
</html>`;

    const origin = request.headers.get("origin") || "*";
    return new NextResponse(fallbackHtml, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Access-Control-Allow-Origin": origin,
      },
    });
  }
}

export async function GET(request: NextRequest, context: any) {
  return handleProxy(request, context);
}

export async function POST(request: NextRequest, context: any) {
  return handleProxy(request, context);
}

export async function PUT(request: NextRequest, context: any) {
  return handleProxy(request, context);
}

export async function DELETE(request: NextRequest, context: any) {
  return handleProxy(request, context);
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": origin || "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}
