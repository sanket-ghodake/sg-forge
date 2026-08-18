import crypto from "crypto";
import fs from "fs";
import path from "path";

// Helper to print with colors
const GREEN = "\x1b[32m";
const CYAN = "\x1b[36m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";

function showHelp() {
  console.log(`${CYAN}SG Forge App Generator${RESET}`);
  console.log(`Usage: bun scripts/create-forge-app.ts <app-name> [options]`);
  console.log("");
  console.log(`Options:`);
  console.log(`  --slug=<slug>  Custom URL slug (default: lowercase name with dashes)`);
  console.log(`  --lang=<ts|py> Programming language/runtime template (default: ts)`);
  console.log("");
  console.log(`Example:`);
  console.log(`  bun scripts/create-forge-app.ts "Billing Center" --lang=ts`);
  process.exit(0);
}

// Parse args
const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h") || args.length === 0) {
  showHelp();
}

let appName = "";
let appSlug = "";
let appLang = "ts";

for (const arg of args) {
  if (arg.startsWith("--slug=")) {
    appSlug = arg.split("=")[1].trim().toLowerCase();
  } else if (arg.startsWith("--lang=")) {
    appLang = arg.split("=")[1].trim().toLowerCase();
  } else if (!arg.startsWith("--")) {
    appName = arg.trim();
  }
}

if (!appName) {
  console.error(`${RED}Error: App name is required.${RESET}`);
  showHelp();
}

if (!appSlug) {
  appSlug = appName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

// Validate slug
if (!/^[a-z0-9_-]+$/.test(appSlug)) {
  console.error(
    `${RED}Error: Slug can only contain lowercase letters, numbers, dashes, and underscores.${RESET}`,
  );
  process.exit(1);
}

const appsDir = path.resolve(process.cwd(), "sandbox/apps");
const targetDir = path.join(appsDir, appSlug);

if (fs.existsSync(targetDir)) {
  console.error(`${RED}Error: App directory already exists at ${targetDir}${RESET}`);
  process.exit(1);
}

// Scan other manifests to find the next unused port (starting from 8080)
console.log(`${CYAN}Scanning existing manifests for port allocations...${RESET}`);
const allocatedPorts = new Set<number>();

if (fs.existsSync(appsDir)) {
  const folders = fs.readdirSync(appsDir);
  for (const folder of folders) {
    const configPath = path.join(appsDir, folder, "app.json");
    if (fs.existsSync(configPath)) {
      try {
        const manifest = JSON.parse(fs.readFileSync(configPath, "utf8"));
        const entryUrl = manifest.entryPoint || manifest.entryUrl || "";
        if (entryUrl) {
          const match = entryUrl.match(/:(\d+)/);
          if (match && match[1]) {
            const port = parseInt(match[1]);
            allocatedPorts.add(port);
            console.log(`  - Discovered ${folder} using port: ${port}`);
          }
        }
      } catch (err) {
        // ignore
      }
    }
  }
}

let selectedPort = 8080;
while (allocatedPorts.has(selectedPort)) {
  selectedPort++;
}

console.log(`${GREEN}Selected next free port: ${selectedPort}${RESET}`);

// Create directory
fs.mkdirSync(targetDir, { recursive: true });

// Create app.json
const schemaName = `forge_${appSlug.replace(/-/g, "_")}`;
const generatedClientId = "client_" + Math.random().toString(36).substring(2, 15);
const generatedClientSecret = "secret_" + crypto.randomUUID().replace(/-/g, "");

const manifest = {
  id: `app_${appSlug.replace(/-/g, "_")}_dev`,
  slug: appSlug,
  version: "1.0.0",
  name: appName,
  description: `Decoupled micro-frontend application running inside the SG Forge sandboxed portal.`,
  icon: "Layers",
  roles: ["super_admin", "admin", "user"],
  entryPoint: `http://localhost:${selectedPort}`,
  routingMode: "iframe",
  clientId: generatedClientId,
  clientSecret: generatedClientSecret,
  database: {
    requiresIsolatedSchema: true,
    schemaName: schemaName,
  },
  targetRules: {
    verticals: ["all"],
    designations: [],
    minJobLevel: 1,
  },
};

fs.writeFileSync(path.join(targetDir, "app.json"), JSON.stringify(manifest, null, 2));
console.log(`${GREEN}Created manifest app.json${RESET}`);

// Create server file based on language
if (appLang === "py") {
  const pythonServer = `import http.server
import socketserver
import json
import urllib.request
import urllib.parse
import os

PORT = ${selectedPort}
HOST = "0.0.0.0" # Bind to all interfaces (required for container mapping)
PORTAL_URL = os.environ.get("PORTAL_URL", "http://localhost:3001")

class CustomAppHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        
        # 1. Health Probe
        if parsed_url.path == "/api/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "active"}).encode("utf-8"))
            return

        # 2. Main Page Render
        if parsed_url.path == "/" or parsed_url.path == "/web-ui":
            query_params = urllib.parse.parse_qs(parsed_url.query)
            code = query_params.get("code", [None])[0]
            user_name = "Guest"
            user_role = "None"
            user_email = ""

            if code:
                try:
                    # Exchange authorization code for JWT user session
                    url = f"{PORTAL_URL}/api/v1/auth/exchange"
                    payload = json.dumps({
                        "code": code,
                        "client_id": "${generatedClientId}",
                        "client_secret": "${generatedClientSecret}"
                    }).encode("utf-8")
                    
                    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"}, method="POST")
                    with urllib.request.urlopen(req, timeout=3) as resp:
                        res_data = json.loads(resp.read().decode("utf-8"))
                        user = res_data.get("user", {})
                        user_name = user.get("name", "User")
                        user_role = user.get("role", "user")
                        user_email = user.get("email", "")
                except Exception as e:
                    print(f"Handshake failed: {e}")

            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            
            html = f"""<!DOCTYPE html>
<html>
<head>
  <title>{appName}</title>
  <style>
    body {{
      background: #0b0c10;
      color: #c5c6c7;
      font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
      padding: 30px;
      margin: 0;
    }}
    .container {{
      max-width: 800px;
      margin: 40px auto;
      background: rgba(31, 40, 51, 0.45);
      border: 1px solid rgba(102, 252, 241, 0.15);
      border-radius: 12px;
      padding: 30px;
      backdrop-filter: blur(10px);
      box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
    }}
    h1 {{
      color: #66fcf1;
      font-size: 2.2rem;
      margin-top: 0;
      background: linear-gradient(90deg, #66fcf1, #45f3ff);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }}
    .badge {{
      display: inline-block;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: bold;
      background: rgba(102, 252, 241, 0.1);
      color: #66fcf1;
      border: 1px solid rgba(102, 252, 241, 0.2);
    }}
    .profile-card {{
      background: rgba(11, 12, 16, 0.6);
      border-radius: 8px;
      padding: 20px;
      margin-top: 25px;
      border-left: 4px solid #66fcf1;
    }}
  </style>
  <!-- Forge SDK Loader -->
  <script src="/sdk/forge-sdk.js" onerror="console.warn('Local SDK was offline, fallback to postMessage interface')"></script>
</head>
<body>
  <div class="container">
    <h1>{appName}</h1>
    <span class="badge">Python Microservice Sandbox</span>
    <p>This is a containerized micro-app sandboxed inside the corporate ecosystem.</p>
    
    <div class="profile-card">
      <h3>Session Authenticated via SSO Handshake</h3>
      <p><strong>Name:</strong> {user_name}</p>
      <p><strong>Role:</strong> {user_role}</p>
      <p><strong>Email:</strong> {user_email}</p>
    </div>
  </div>

  <script>
    // Theme alignment and Ready check
    document.addEventListener("DOMContentLoaded", function() {{
      const hasSdk = typeof ForgeClient !== 'undefined';
      console.log("[App] SDK Loaded status:", hasSdk);
      
      if (hasSdk) {{
        const client = new ForgeClient();
        client.onThemeChange(function(payload) {{
          document.documentElement.setAttribute('data-theme', payload.theme);
        }});
        client.notifyReady();
      }} else {{
        // Fallback postMessage handshakes
        window.parent.postMessage({{ type: 'FORGE_IFRAME_READY' }}, "*");
        window.addEventListener("message", function(e) {{
          if (e.data && e.data.type === 'FORGE_THEME_CHANGE') {{
            document.documentElement.setAttribute('data-theme', e.data.theme);
          }}
        }});
      }}
    }});
  </script>
</body>
</html>
"""
            self.wfile.write(html.encode("utf-8"))
            return
            
        self.send_error(404, "Not Found")

if __name__ == "__main__":
    with socketserver.TCPServer((HOST, PORT), CustomAppHandler) as httpd:
        print(f"Python Server listening on http://{{HOST}}:{{PORT}}")
        httpd.serve_forever()
`;
  fs.writeFileSync(path.join(targetDir, "server.py"), pythonServer);
  console.log(`${GREEN}Created python server template server.py${RESET}`);
} else {
  // TS template using Bun
  const tsServer = `import { serve } from "bun";

const PORT = ${selectedPort};
const HOST = "0.0.0.0"; // Bind to all interfaces (required for container mapping)
const PORTAL_URL = process.env.PORTAL_URL || "http://localhost:3001";

const server = serve({
  port: PORT,
  hostname: HOST,
  async fetch(req) {
    const url = new URL(req.url);

    // 1. Health check probe for gateway registration
    if (url.pathname === "/api/health") {
      return new Response(JSON.stringify({ status: "active" }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // 2. Main Page Render (SSO token exchange handshake)
    if (url.pathname === "/" || url.pathname === "/web-ui") {
      const code = url.searchParams.get("code");
      let userName = "Guest";
      let userRole = "None";
      let userEmail = "";

      if (code) {
        try {
          // Exchange code with portal backchannel
          const exchangeRes = await fetch(\`\${PORTAL_URL}/api/v1/auth/exchange\`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code,
              client_id: "${generatedClientId}",
              client_secret: "${generatedClientSecret}"
            })
          });

          if (exchangeRes.ok) {
            const data = await exchangeRes.json() as any;
            userName = data.user.name;
            userRole = data.user.role;
            userEmail = data.user.email;
          } else {
            console.error("Exchange code failed with status:", exchangeRes.status);
          }
        } catch (err) {
          console.error("Backend code exchange failed:", err);
        }
      }

      const html = \`<!DOCTYPE html>
<html>
<head>
  <title>${appName}</title>
  <style>
    body {
      background: #0b0c10;
      color: #c5c6c7;
      font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
      padding: 30px;
      margin: 0;
    }
    .container {
      max-width: 800px;
      margin: 40px auto;
      background: rgba(31, 40, 51, 0.45);
      border: 1px solid rgba(102, 252, 241, 0.15);
      border-radius: 12px;
      padding: 30px;
      backdrop-filter: blur(10px);
      box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
    }
    h1 {
      color: #66fcf1;
      font-size: 2.2rem;
      margin-top: 0;
      background: linear-gradient(90deg, #66fcf1, #45f3ff);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: bold;
      background: rgba(102, 252, 241, 0.1);
      color: #66fcf1;
      border: 1px solid rgba(102, 252, 241, 0.2);
    }
    .profile-card {
      background: rgba(11, 12, 16, 0.6);
      border-radius: 8px;
      padding: 20px;
      margin-top: 25px;
      border-left: 4px solid #66fcf1;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${appName}</h1>
    <span class="badge">Bun & TypeScript Sandbox App</span>
    <p>This is a containerized micro-app sandboxed inside the corporate ecosystem.</p>
    
    <div class="profile-card">
      <h3>Session Authenticated via SSO Handshake</h3>
      <p><strong>Name:</strong> \${userName}</p>
      <p><strong>Role:</strong> \${userRole}</p>
      <p><strong>Email:</strong> \${userEmail}</p>
    </div>
  </div>

  <script>
    // Theme alignment and Ready check
    document.addEventListener("DOMContentLoaded", function() {
      // Fallback postMessage handshakes
      window.parent.postMessage({ type: 'FORGE_IFRAME_READY' }, "*");
      window.addEventListener("message", function(e) {
        if (e.data && e.data.type === 'FORGE_THEME_CHANGE') {
          document.documentElement.setAttribute('data-theme', e.data.theme);
        }
      });
    });
  </script>
</body>
</html>\`;

      return new Response(html, {
        headers: { "Content-Type": "text/html" }
      });
    }

    return new Response("Not Found", { status: 404 });
  }
});

console.log(\`🚀 Bun Server listening on http://\${HOST}:\${PORT}\`);
`;
  fs.writeFileSync(path.join(targetDir, "server.ts"), tsServer);
  console.log(`${GREEN}Created Bun/TS server template server.ts${RESET}`);
}

const readme = `# ${appName}

This is a sandboxed Forge micro-app generated for the SG Forge portal.

## Configuration Details
*   **Slug**: \`${appSlug}\`
*   **Port**: \`${selectedPort}\`
*   **Database Schema**: \`${schemaName}\`

## How it works
1.  **Process Spawning**: The dynamic app runner (\`scripts/dynamic-app-runner.ts\`) automatically launches the server.
2.  **Reverse Proxy**: In Docker dev mode, requests to \`/forge-apps/${appSlug}\` route to your server port internally.
3.  **Authentication**: When loaded in the portal, your app's entryPoint receives an auth \`?code=\` parameters. Exchange it via \`POST /api/v1/auth/exchange\` to fetch the JWT user profile.
`;

fs.writeFileSync(path.join(targetDir, "README.md"), readme);
console.log(`${GREEN}Created README.md${RESET}`);

console.log("");
console.log(`${GREEN}✨ Custom Forge App successfully scaffolded!${RESET}`);
console.log(`Add your app code in: ${targetDir}`);
console.log(`To run it, start the platform via: ./run.sh`);
