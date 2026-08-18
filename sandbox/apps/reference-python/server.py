import http.server
import socketserver
import urllib.request
import urllib.error
import json
import os
import sys
from urllib.parse import urlparse, parse_qs

PORT = 8087
PORTAL_URL = os.environ.get("PORTAL_URL", "http://localhost:3001")
DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgres://lifeos:change_me_db_password@localhost:5432/org_db"
)

# In-memory document storage
documents_store = [
    {
        "id": "doc_1",
        "title": "Enterprise Python Runtime Spec",
        "owner": "SG Forge Core Division",
        "status": "approved",
    },
    {
        "id": "doc_2",
        "title": "Platform Extension Proposal",
        "owner": "System",
        "status": "pending",
    },
]


def write_portal_audit_log(access_token, action, severity, payload):
    url = f"{PORTAL_URL}/api/v1/audit/log"
    body = json.dumps(
        {"action": action, "severity": severity, "payload": payload}
    ).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {access_token}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=3) as resp:
            resp.read()
    except Exception as e:
        print(f"[reference-python] Failed to send audit log: {e}", file=sys.stderr)


def validate_token_via_portal(access_token):
    """
    Validates token and fetches profile info by making a request to the platform user API.
    This shows a completely database-agnostic architecture.
    """
    url = f"{PORTAL_URL}/api/v1/user"
    req = urllib.request.Request(
        url, headers={"Authorization": f"Bearer {access_token}"}, method="GET"
    )
    try:
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            user_info = data.get("user", {})
            return user_info, True
    except urllib.error.HTTPError as e:
        print(
            f"[reference-python] Portal validation HTTP error: {e.code}",
            file=sys.stderr,
        )
        return None, False
    except Exception as e:
        print(
            f"[reference-python] Portal validation request exception: {e}",
            file=sys.stderr,
        )
        return None, False


def query_app_credentials():
    """
    Retrieves client_id and client_secret of reference-python.
    Prioritizes reading from CLIENT_ID and CLIENT_SECRET environment variables injected by the orchestrator.
    Falls back to querying the database via psql only if environment variables are not set.
    """
    # 2026 Security Standard: Read injected credentials from environment variables to bypass DB dependency & subprocess spawning
    env_client_id = os.environ.get("CLIENT_ID")
    env_client_secret = os.environ.get("CLIENT_SECRET")
    if env_client_id and env_client_secret:
        return env_client_id, env_client_secret

    import subprocess

    try:
        cmd = [
            "psql",
            DATABASE_URL,
            "-t",
            "-A",
            "-c",
            "SELECT client_id, client_secret FROM forge_apps WHERE slug = 'reference-python'",
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=3)
        if res.returncode == 0 and res.stdout.strip():
            parts = res.stdout.strip().split("|")
            if len(parts) == 2:
                return parts[0], parts[1]
    except Exception as e:
        print(f"[reference-python] Failed to query DB via psql: {e}", file=sys.stderr)

    # Fallbacks if psql is not available
    return "client_reference_python", "secret_reference_python_dev_key"


class ReferenceAppHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Override to suppress noisy stdout logs
        pass

    def do_GET(self):
        parsed_url = urlparse(self.path)

        # 1. Health Endpoint
        if parsed_url.path == "/api/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "active"}).encode("utf-8"))
            return

        # 2. API: Documents List
        if parsed_url.path == "/api/documents":
            auth_header = self.headers.get("Authorization", "")
            if not auth_header.startswith("Bearer "):
                self.send_error(401, "Unauthorized")
                return
            token = auth_header[7:].strip()

            user_info, valid = validate_token_via_portal(token)
            if not valid:
                self.send_error(403, "Forbidden")
                return

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(documents_store).encode("utf-8"))
            return

        # 3. Serving Frontend Template at /
        if parsed_url.path == "/":
            query_params = parse_qs(parsed_url.query)
            code = query_params.get("code", [None])[0]
            session_data = None
            client_id, client_secret = query_app_credentials()

            if code:
                # Perform code exchange with host portal
                url = f"{PORTAL_URL}/api/v1/auth/exchange"
                body = json.dumps(
                    {
                        "code": code,
                        "client_id": client_id,
                        "client_secret": client_secret,
                    }
                ).encode("utf-8")

                req = urllib.request.Request(
                    url,
                    data=body,
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                try:
                    with urllib.request.urlopen(req, timeout=3) as resp:
                        res = json.loads(resp.read().decode("utf-8"))
                        session_data = {
                            "accessToken": res.get("access_token"),
                            "user": res.get("user"),
                            "scopes": res.get("scopes", ["user.profile.read"]),
                        }
                except Exception as e:
                    print(
                        f"[reference-python] OAuth exchange failed: {e}",
                        file=sys.stderr,
                    )

            # Serve UI HTML
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()

            session_str = json.dumps(session_data) if session_data else "null"
            rendered_html = HTML_TEMPLATE.replace(
                "{{SESSION_DATA}}", session_str
            ).replace("{{CLIENT_ID}}", client_id)
            self.wfile.write(rendered_html.encode("utf-8"))
            return

        self.send_error(404, "Not Found")

    def do_POST(self):
        parsed_url = urlparse(self.path)

        # 1. API: Create Document
        if parsed_url.path == "/api/documents":
            auth_header = self.headers.get("Authorization", "")
            if not auth_header.startswith("Bearer "):
                self.send_error(401, "Unauthorized")
                return
            token = auth_header[7:].strip()

            user_info, valid = validate_token_via_portal(token)
            if not valid:
                self.send_error(403, "Forbidden")
                return

            try:
                content_length = int(self.headers.get("Content-Length", 0))
                post_data = self.rfile.read(content_length)
                body = json.loads(post_data.decode("utf-8"))

                new_doc = {
                    "id": f"doc_{len(documents_store) + 1}",
                    "title": body.get("title", "Untitled Document"),
                    "owner": user_info.get("name", "Unknown Owner"),
                    "status": "pending",
                }
                documents_store.append(new_doc)

                # Write audit log to portal
                write_portal_audit_log(
                    token,
                    "python.document.created",
                    "INFO",
                    {"title": new_doc["title"]},
                )

                self.send_response(201)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(new_doc).encode("utf-8"))
            except Exception as e:
                self.send_error(500, f"Error: {e}")
            return

        self.send_error(404, "Not Found")


HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reference Python App</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090a0f;
      --panel: rgba(17, 18, 27, 0.7);
      --border: rgba(255, 255, 255, 0.08);
      --text: #f3f4f6;
      --text-muted: #9ca3af;
      --primary: #3b82f6;
      --primary-hover: #2563eb;
      --warning: #f59e0b;
      --danger: #ef4444;
      --glow: rgba(59, 130, 246, 0.15);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Outfit', sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      padding: 24px;
    }
    .container { max-width: 1000px; margin: 0 auto; }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
    }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand-logo {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      background: linear-gradient(135deg, var(--primary), #8b5cf6);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      color: white;
      box-shadow: 0 0 15px var(--glow);
    }
    h1 { font-size: 20px; font-weight: 600; }
    .user-pill {
      background: var(--panel);
      border: 1px solid var(--border);
      padding: 6px 12px;
      border-radius: 9999px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--primary);
      box-shadow: 0 0 8px var(--primary);
    }
    .layout {
      display: grid;
      grid-template-columns: 1fr 2fr;
      gap: 24px;
    }
    @media (max-width: 768px) {
      .layout { grid-template-columns: 1fr; }
    }
    .card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 24px;
      backdrop-filter: blur(12px);
    }
    .card-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 20px;
    }
    .form-group { margin-bottom: 16px; }
    label { display: block; font-size: 13px; color: var(--text-muted); margin-bottom: 6px; }
    input {
      width: 100%;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px 14px;
      color: var(--text);
      font-family: inherit;
      font-size: 14px;
    }
    input:focus { outline: none; border-color: var(--primary); }
    button.btn {
      width: 100%;
      background: var(--primary);
      color: white;
      border: none;
      border-radius: 8px;
      padding: 12px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    button.btn:hover { background: var(--primary-hover); }
    table { width: 100%; border-collapse: collapse; text-align: left; }
    th { font-size: 13px; color: var(--text-muted); padding: 12px 16px; border-bottom: 1px solid var(--border); }
    td { padding: 14px 16px; border-bottom: 1px solid var(--border); font-size: 14px; }
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      background: rgba(59, 130, 246, 0.15);
      color: var(--primary);
    }
  </style>
</head>
<body>
  <div class="container">
    <div id="no-session" style="display: none; text-align: center; margin-top: 100px;">
      <h2 style="font-weight: 500; margin-bottom: 16px;">Connecting to SG Forge Session (Python)...</h2>
      <div style="color: var(--text-muted); margin-bottom: 24px;">Please launch this application through the SG Forge Application Portal or sign in below.</div>
      <button onclick="authorizeDirect()" class="btn" style="max-width: 280px; margin: 0 auto; display: block; background: linear-gradient(135deg, var(--primary), #8b5cf6); box-shadow: 0 0 15px var(--glow);">Authorize via Org Manager</button>
    </div>

    <div id="session-active" style="display: none;">
      <header>
        <div class="brand">
          <div class="brand-logo">P</div>
          <h1>Python Reference Documents Manager</h1>
        </div>
        <div class="user-pill">
          <span class="status-dot"></span>
          <span id="user-display">Loading...</span>
        </div>
      </header>

      <div class="layout">
        <div class="card">
          <div class="card-title">Register Document</div>
          <form id="doc-form">
            <div class="form-group">
              <label for="title">Document Title</label>
              <input type="text" id="title" required placeholder="e.g. Org Security Guidelines">
            </div>
            <button type="submit" class="btn">Register</button>
          </form>
        </div>

        <div class="card">
          <div class="card-title">Active Documents Ledger</div>
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Author</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="ledger-body">
              <tr>
                <td colspan="3" style="text-align: center; color: var(--text-muted);">Fetching documents...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <script>
    const session = {{SESSION_DATA}};
    const clientId = "{{CLIENT_ID}}";

    function authorizeDirect() {
      const redirectUri = window.location.origin + '/';
      const portalUrl = window.location.protocol + '//' + window.location.hostname + ':3001';
      window.location.href = portalUrl + '/api/v1/auth/authorize?client_id=' + clientId + '&redirect_uri=' + encodeURIComponent(redirectUri) + '&state=direct_login&response_type=code';
    }

    if (!session || !session.accessToken) {
      document.getElementById('no-session').style.display = 'block';
    } else {
      document.getElementById('session-active').style.display = 'block';
      document.getElementById('user-display').innerText = session.user.name + ' (' + session.user.role + ')';

      fetchDocs();

      document.getElementById('doc-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('title').value;

        const res = await fetch('/api/documents', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + session.accessToken
          },
          body: JSON.stringify({ title })
        });

        if (res.ok) {
          document.getElementById('title').value = '';
          fetchDocs();
        }
      });
    }

    async function fetchDocs() {
      const res = await fetch('/api/documents', {
        headers: { 'Authorization': 'Bearer ' + session.accessToken }
      });
      if (res.ok) {
        const docs = await res.json();
        const body = document.getElementById('ledger-body');
        if (!docs || docs.length === 0) {
          body.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">No documents found.</td></tr>';
          return;
        }
        body.innerHTML = '';
        docs.forEach(d => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${d.title}</td>
            <td>${d.owner}</td>
            <td><span class="badge">${d.status}</span></td>
          `;
          body.appendChild(tr);
        });
      }
    }
  </script>
</body>
</html>"""

if __name__ == "__main__":
    with socketserver.TCPServer(("0.0.0.0", PORT), ReferenceAppHandler) as httpd:
        print(f"[reference-python] Listening on port {PORT}...")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
