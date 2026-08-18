import { serve } from "bun";

const PORT = 8080;
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
        headers: { "Content-Type": "application/json" },
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
          const exchangeRes = await fetch(`${PORTAL_URL}/api/v1/auth/exchange`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code,
              client_id: "app_telemetry_dashboard_dev",
              client_secret: "my-client-secret",
            }),
          });

          if (exchangeRes.ok) {
            const data = (await exchangeRes.json()) as any;
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

      const html = `<!DOCTYPE html>
<html>
<head>
  <title>Telemetry Dashboard</title>
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
    <h1>Telemetry Dashboard</h1>
    <span class="badge">Bun & TypeScript Sandbox App</span>
    <p>This is a containerized micro-app sandboxed inside the corporate ecosystem.</p>
    
    <div class="profile-card">
      <h3>Session Authenticated via SSO Handshake</h3>
      <p><strong>Name:</strong> ${userName}</p>
      <p><strong>Role:</strong> ${userRole}</p>
      <p><strong>Email:</strong> ${userEmail}</p>
      ${
        userName === "Guest"
          ? `
      <div style="margin-top: 20px; border-top: 1px solid rgba(102, 252, 241, 0.15); padding-top: 15px;">
        <button onclick="authorizeDirect()" style="background: linear-gradient(90deg, #66fcf1, #45f3ff); color: #0b0c10; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer;">Authorize via Org Manager</button>
      </div>`
          : ""
      }
    </div>
  </div>

  <script>
    function authorizeDirect() {
      const redirectUri = window.location.origin + '/';
      const portalUrl = window.location.protocol + '//' + window.location.hostname + ':3001';
      window.location.href = portalUrl + '/api/v1/auth/authorize?client_id=app_telemetry_dashboard_dev&redirect_uri=' + encodeURIComponent(redirectUri) + '&state=direct_login&response_type=code';
    }

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
</html>`;

      return new Response(html, {
        headers: { "Content-Type": "text/html" },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`🚀 Bun Server listening on http://${HOST}:${PORT}`);
