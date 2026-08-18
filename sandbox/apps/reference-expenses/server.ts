import { Pool } from "pg";

const PORT = 8085;
const connectionString =
  process.env.DATABASE_URL || "postgres://lifeos:change_me_db_password@localhost:5432/org_db";
const PORTAL_URL = process.env.PORTAL_URL || "http://localhost:3001";

const pool = new Pool({
  connectionString,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  keepAlive: true,
});

pool.on("error", (err) => {
  console.warn("[reference-expenses] Unexpected idle client error on database pool:", err.message);
});

// Create tables in isolated schema when app boots
async function initializeSchema() {
  console.log("[reference-expenses] Provisioning isolated database schema...");
  for (let attempt = 1; attempt <= 30; attempt++) {
    try {
      await pool.query("CREATE SCHEMA IF NOT EXISTS forge_reference_expenses");
      await pool.query(`
        CREATE TABLE IF NOT EXISTS forge_reference_expenses.expenses (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title VARCHAR(255) NOT NULL,
          amount DECIMAL(10, 2) NOT NULL,
          category VARCHAR(100) NOT NULL,
          user_id UUID NOT NULL,
          user_name VARCHAR(255) NOT NULL,
          status VARCHAR(50) DEFAULT 'pending' NOT NULL,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL
        )
      `);
      console.log("[reference-expenses] Isolated schema configured successfully.");
      return;
    } catch (err: any) {
      console.warn(`[reference-expenses] Waiting for database (${attempt}/30)...:`, err.message);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

initializeSchema();

// Helper to write audit logs to main portal
async function writePortalAuditLog(
  accessToken: string,
  action: string,
  severity: string,
  payload: any,
) {
  try {
    await fetch(`${PORTAL_URL}/api/v1/audit/log`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ action, severity, payload }),
    });
  } catch (err) {
    console.error("[reference-expenses] Failed to write portal audit log:", err);
  }
}

// Helper to parse Bearer token
function getBearerToken(req: Request): string | null {
  const auth = req.headers.get("Authorization") || "";
  if (auth.startsWith("Bearer ")) {
    return auth.slice(7).trim();
  }
  return null;
}

// Helper to check token permissions
async function validateTokenAndPermissions(
  accessToken: string,
  requiredScope?: string,
): Promise<{ userId: string; userName: string; scopes: string[] } | null> {
  try {
    const res = await pool.query(
      `SELECT u.id, u.name, t.scope 
       FROM forge_access_tokens t
       JOIN users u ON t.user_id = u.id
       WHERE t.access_token = $1 AND t.expires_at > NOW()`,
      [accessToken],
    );
    if (res.rows.length === 0) return null;

    const row = res.rows[0];
    const scopes = (row.scope || []) as string[];

    if (requiredScope && !scopes.includes(requiredScope)) {
      return null;
    }

    return {
      userId: row.id,
      userName: row.name,
      scopes,
    };
  } catch (err) {
    console.error("[reference-expenses] Token validation error:", err);
    return null;
  }
}

const server = Bun.serve({
  port: PORT,
  hostname: "0.0.0.0",
  async fetch(req) {
    const url = new URL(req.url);

    // 1. GET / - App Frame Entry Point
    if (req.method === "GET" && url.pathname === "/") {
      const code = url.searchParams.get("code");
      let sessionData = null;

      // 2026 Security Standards: Read credentials directly from environment variables if present
      let clientId = Bun.env.CLIENT_ID;
      let clientSecret = Bun.env.CLIENT_SECRET;

      try {
        if (!clientId || !clientSecret) {
          // Query client_id and client_secret from database
          const appRes = await pool.query(
            "SELECT client_id, client_secret FROM forge_apps WHERE slug = 'reference-expenses'",
          );
          if (appRes.rows.length > 0) {
            clientId = appRes.rows[0].client_id;
            clientSecret = appRes.rows[0].client_secret;
          }
        }

        if (code) {
          // Exchange code for access token via main portal
          const exchangeRes = await fetch(`${PORTAL_URL}/api/v1/auth/exchange`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code,
              client_id,
              client_secret,
            }),
          });

          if (exchangeRes.ok) {
            const body = await exchangeRes.json();
            sessionData = {
              accessToken: body.access_token,
              user: body.user,
              scopes: body.scopes || [],
            };
          }
        }
      } catch (err) {
        console.error("[reference-expenses] Database or OAuth exchange failed:", err);
      }

      // Serve HTML UI
      return new Response(getHtmlTemplate(sessionData, clientId), {
        headers: { "Content-Type": "text/html" },
      });
    }

    // 2. GET /api/expenses - List Expenses
    if (req.method === "GET" && url.pathname === "/api/expenses") {
      const token = getBearerToken(req);
      if (!token) return new Response("Unauthorized", { status: 401 });

      const auth = await validateTokenAndPermissions(token, "expense.read");
      if (!auth) {
        // Log unauthorized read attempt
        await writePortalAuditLog(token, "expense.read.denied", "WARN", {
          reason: "Missing scope expense.read",
        });
        return new Response("Forbidden", { status: 403 });
      }

      try {
        const res = await pool.query(
          "SELECT * FROM forge_reference_expenses.expenses ORDER BY created_at DESC",
        );
        return new Response(JSON.stringify(res.rows), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }

    // 3. POST /api/expenses - Create Expense
    if (req.method === "POST" && url.pathname === "/api/expenses") {
      const token = getBearerToken(req);
      if (!token) return new Response("Unauthorized", { status: 401 });

      const auth = await validateTokenAndPermissions(token, "expense.create");
      if (!auth) {
        await writePortalAuditLog(token, "expense.create.denied", "WARN", {
          reason: "Missing scope expense.create",
        });
        return new Response("Forbidden", { status: 403 });
      }

      try {
        const body = await req.json();
        const { title, amount, category } = body;

        const res = await pool.query(
          `INSERT INTO forge_reference_expenses.expenses (title, amount, category, user_id, user_name)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [title, amount, category, auth.userId, auth.userName],
        );

        // Audit success log
        await writePortalAuditLog(token, "expense.created", "INFO", { title, amount, category });

        return new Response(JSON.stringify(res.rows[0]), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }

    // 4. POST /api/expenses/approve - Approve Expense
    if (req.method === "POST" && url.pathname === "/api/expenses/approve") {
      const token = getBearerToken(req);
      if (!token) return new Response("Unauthorized", { status: 401 });

      const auth = await validateTokenAndPermissions(token, "expense.approve");
      if (!auth) {
        await writePortalAuditLog(token, "expense.approve.denied", "CRITICAL", {
          reason: "Attempted approval without expense.approve scope",
        });
        return new Response("Forbidden", { status: 403 });
      }

      try {
        const body = await req.json();
        const { id } = body;

        await pool.query(
          "UPDATE forge_reference_expenses.expenses SET status = 'approved' WHERE id = $1",
          [id],
        );

        await writePortalAuditLog(token, "expense.approved", "INFO", {
          expenseId: id,
          approver: auth.userName,
        });
        return new Response(JSON.stringify({ success: true }));
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }

    // 5. POST /api/expenses/delete - Delete Expense
    if (req.method === "POST" && url.pathname === "/api/expenses/delete") {
      const token = getBearerToken(req);
      if (!token) return new Response("Unauthorized", { status: 401 });

      const auth = await validateTokenAndPermissions(token, "expense.delete");
      if (!auth) {
        await writePortalAuditLog(token, "expense.delete.denied", "CRITICAL", {
          reason: "Attempted deletion without expense.delete scope",
        });
        return new Response("Forbidden", { status: 403 });
      }

      try {
        const body = await req.json();
        const { id } = body;

        await pool.query("DELETE FROM forge_reference_expenses.expenses WHERE id = $1", [id]);

        await writePortalAuditLog(token, "expense.deleted", "WARN", {
          expenseId: id,
          deleter: auth.userName,
        });
        return new Response(JSON.stringify({ success: true }));
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }

    // 6. GET /api/health - Health check URL
    if (req.method === "GET" && url.pathname === "/api/health") {
      return new Response(
        JSON.stringify({ status: "active", timestamp: new Date().toISOString() }),
        {
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`[reference-expenses] Server listening on port ${PORT}`);

function getHtmlTemplate(session: any, clientId: string): string {
  const sessionStr = JSON.stringify(session);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reference Expenses tracker</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090a0f;
      --panel: rgba(17, 18, 27, 0.7);
      --border: rgba(255, 255, 255, 0.08);
      --text: #f3f4f6;
      --text-muted: #9ca3af;
      --primary: #6366f1;
      --primary-hover: #4f46e5;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
      --glow: rgba(99, 102, 241, 0.15);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Outfit', sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      padding: 24px;
      overflow-x: hidden;
    }

    /* Glassmorphic Container */
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-logo {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      background: linear-gradient(135deg, var(--primary), #ec4899);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      color: white;
      box-shadow: 0 0 15px var(--glow);
    }

    h1 {
      font-size: 20px;
      font-weight: 600;
    }

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
      background: var(--success);
      box-shadow: 0 0 8px var(--success);
    }

    /* Dashboard Widgets */
    .widgets {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .widget {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      backdrop-filter: blur(10px);
      box-shadow: 0 4px 30px rgba(0, 0, 0, 0.4);
    }

    .widget-title {
      font-size: 13px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 8px;
    }

    .widget-value {
      font-size: 28px;
      font-weight: 700;
      color: var(--text);
    }

    /* Main Grid Layout */
    .layout {
      display: grid;
      grid-template-columns: 1fr 2fr;
      gap: 24px;
    }

    @media (max-width: 768px) {
      .layout {
        grid-template-columns: 1fr;
      }
    }

    .card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 24px;
      backdrop-filter: blur(12px);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    }

    .card-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    /* Forms */
    .form-group {
      margin-bottom: 16px;
    }

    label {
      display: block;
      font-size: 13px;
      color: var(--text-muted);
      margin-bottom: 6px;
    }

    input, select {
      width: 100%;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px 14px;
      color: var(--text);
      font-family: inherit;
      font-size: 14px;
      transition: all 0.2s;
    }

    input:focus, select:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 10px var(--glow);
    }

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

    button.btn:hover {
      background: var(--primary-hover);
      transform: translateY(-1px);
    }

    /* Expenses List Table */
    .table-container {
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }

    th {
      font-size: 13px;
      color: var(--text-muted);
      font-weight: 500;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
    }

    td {
      padding: 14px 16px;
      border-bottom: 1px solid var(--border);
      font-size: 14px;
    }

    tr:last-child td {
      border-bottom: none;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .badge-pending {
      background: rgba(245, 158, 11, 0.15);
      color: var(--warning);
    }

    .badge-approved {
      background: rgba(16, 185, 129, 0.15);
      color: var(--success);
    }

    .btn-action {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
      border: none;
      font-weight: 500;
      transition: all 0.2s;
      margin-right: 4px;
    }

    .btn-approve {
      background: rgba(16, 185, 129, 0.15);
      color: var(--success);
    }

    .btn-approve:hover {
      background: var(--success);
      color: white;
    }

    .btn-delete {
      background: rgba(239, 68, 68, 0.15);
      color: var(--danger);
    }

    .btn-delete:hover {
      background: var(--danger);
      color: white;
    }

    /* Error Message Overlay */
    .error-toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: var(--danger);
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
      display: none;
      animation: slideIn 0.3s forwards;
      z-index: 1000;
    }

    @keyframes slideIn {
      from { transform: translateY(100px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  </style>
</head>
<body>
  <div class="container" id="app">
    <div id="no-session" style="display: none; text-align: center; margin-top: 100px;">
      <h2 style="font-weight: 500; margin-bottom: 16px;">Connecting to SG Forge Session...</h2>
      <div style="color: var(--text-muted); margin-bottom: 24px;">Please launch this application through the SG Forge Application Portal, or sign in below.</div>
      <button onclick="authorizeDirect()" class="btn" style="max-width: 280px; margin: 0 auto; display: block; background: linear-gradient(135deg, var(--primary), #ec4899); box-shadow: 0 0 15px var(--glow);">Authorize via Org Manager</button>
    </div>

    <div id="session-active" style="display: none;">
      <header>
        <div class="brand">
          <div class="brand-logo">E</div>
          <h1>Reference Expense Ledger</h1>
        </div>
        <div class="user-pill">
          <span class="status-dot"></span>
          <span id="user-display">Loading...</span>
        </div>
      </header>

      <!-- Stats -->
      <div class="widgets">
        <div class="widget">
          <div class="widget-title">Total Claims</div>
          <div class="widget-value" id="stat-total">$0.00</div>
        </div>
        <div class="widget">
          <div class="widget-title">Approved claims</div>
          <div class="widget-value" id="stat-approved" style="color: var(--success);">$0.00</div>
        </div>
        <div class="widget">
          <div class="widget-title">Pending approval</div>
          <div class="widget-value" id="stat-pending" style="color: var(--warning);">$0.00</div>
        </div>
      </div>

      <!-- Main Layout -->
      <div class="layout">
        <!-- Create Form -->
        <div class="card" id="create-card">
          <div class="card-title">New Expense Claim</div>
          <form id="expense-form">
            <div class="form-group">
              <label for="title">Title / Purpose</label>
              <input type="text" id="title" required placeholder="e.g. Travel to client site">
            </div>
            <div class="form-group">
              <label for="amount">Amount ($)</label>
              <input type="number" id="amount" step="0.01" required placeholder="0.00">
            </div>
            <div class="form-group">
              <label for="category">Category</label>
              <select id="category" required>
                <option value="Travel">Travel & Lodging</option>
                <option value="Hardware">Hardware & Equipment</option>
                <option value="Software">Software & Subscriptions</option>
                <option value="Meals">Meals & Entertainment</option>
                <option value="Other">Other Expenses</option>
              </select>
            </div>
            <button type="submit" class="btn" id="submit-btn">File Expense</button>
          </form>
        </div>

        <!-- Expense Ledger -->
        <div class="card">
          <div class="card-title">Ledger Transactions</div>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Purpose</th>
                  <th>Category</th>
                  <th>Claimant</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="ledger-body">
                <tr>
                  <td colspan="6" style="text-align: center; color: var(--text-muted);">Fetching transactions...</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="error-toast" id="error-toast">Action Forbidden: Permission missing.</div>

  <script>
    const session = ${sessionStr};
    const clientId = "${clientId}";

    function authorizeDirect() {
      const redirectUri = window.location.origin + '/';
      const portalUrl = window.location.protocol + '//' + window.location.hostname + ':3001';
      window.location.href = portalUrl + '/api/v1/auth/authorize?client_id=' + clientId + '&redirect_uri=' + encodeURIComponent(redirectUri) + '&state=direct_login&response_type=code';
    }

    function showToast(msg) {
      const toast = document.getElementById('error-toast');
      toast.innerText = msg;
      toast.style.display = 'block';
      setTimeout(() => {
        toast.style.display = 'none';
      }, 3000);
    }

    if (!session || !session.accessToken) {
      document.getElementById('no-session').style.display = 'block';
    } else {
      document.getElementById('session-active').style.display = 'block';
      document.getElementById('user-display').innerText = session.user.name + ' (' + session.user.role + ')';

      // Check if user is forbidden to create
      if (!session.scopes.includes('expense.create')) {
        document.getElementById('create-card').style.opacity = '0.5';
        document.getElementById('submit-btn').disabled = true;
        document.getElementById('submit-btn').innerText = 'Submission Locked';
      }

      fetchExpenses();

      // Form submission
      document.getElementById('expense-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('title').value;
        const amount = parseFloat(document.getElementById('amount').value);
        const category = document.getElementById('category').value;

        const res = await fetch('/api/expenses', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + session.accessToken
          },
          body: JSON.stringify({ title, amount, category })
        });

        if (res.ok) {
          document.getElementById('title').value = '';
          document.getElementById('amount').value = '';
          fetchExpenses();
        } else if (res.status === 403) {
          showToast('Forbidden: Missing scope expense.create');
        }
      });
    }

    async function fetchExpenses() {
      const res = await fetch('/api/expenses', {
        headers: { 'Authorization': 'Bearer ' + session.accessToken }
      });

      if (!res.ok) {
        if (res.status === 403) {
          document.getElementById('ledger-body').innerHTML = \`<tr><td colspan="6" style="text-align: center; color: var(--danger);">Forbidden: Access scope expense.read missing</td></tr>\`;
        }
        return;
      }

      const expenses = await res.json();
      renderLedger(expenses);
    }

    function renderLedger(expenses) {
      const body = document.getElementById('ledger-body');
      if (expenses.length === 0) {
        body.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No expense reports recorded.</td></tr>';
        updateStats([]);
        return;
      }

      body.innerHTML = '';
      expenses.forEach(exp => {
        const tr = document.createElement('tr');

        const badgeClass = exp.status === 'approved' ? 'badge-approved' : 'badge-pending';
        
        let actionButtons = '';
        if (exp.status === 'pending') {
          // Render disabled buttons if client scope is missing, which proves secure client degradation
          const hasApprove = session.scopes.includes('expense.approve');
          const hasDelete = session.scopes.includes('expense.delete');

          actionButtons += \`<button class="btn-action btn-approve" \${hasApprove ? '' : 'style="opacity: 0.4; cursor: not-allowed;"'} onclick="approveExpense('\${exp.id}', \${hasApprove})">Approve</button>\`;
          actionButtons += \`<button class="btn-action btn-delete" \${hasDelete ? '' : 'style="opacity: 0.4; cursor: not-allowed;"'} onclick="deleteExpense('\${exp.id}', \${hasDelete})">Delete</button>\`;
        } else {
          const hasDelete = session.scopes.includes('expense.delete');
          actionButtons += \`<button class="btn-action btn-delete" \${hasDelete ? '' : 'style="opacity: 0.4; cursor: not-allowed;"'} onclick="deleteExpense('\${exp.id}', \${hasDelete})">Delete</button>\`;
        }

        tr.innerHTML = \`
          <td>\${exp.title}</td>
          <td>\${exp.category}</td>
          <td>\${exp.user_name}</td>
          <td style="font-weight: 500;">$\${parseFloat(exp.amount).toFixed(2)}</td>
          <td><span class="badge \${badgeClass}">\${exp.status}</span></td>
          <td>\${actionButtons}</td>
        \`;
        body.appendChild(tr);
      });

      updateStats(expenses);
    }

    function updateStats(expenses) {
      let total = 0;
      let approved = 0;
      let pending = 0;

      expenses.forEach(e => {
        const amt = parseFloat(e.amount);
        total += amt;
        if (e.status === 'approved') approved += amt;
        else pending += amt;
      });

      document.getElementById('stat-total').innerText = '$' + total.toFixed(2);
      document.getElementById('stat-approved').innerText = '$' + approved.toFixed(2);
      document.getElementById('stat-pending').innerText = '$' + pending.toFixed(2);
    }

    async function approveExpense(id, hasPerm) {
      if (!hasPerm) {
        // Force endpoint call anyway to test backend security guard
        const res = await fetch('/api/expenses/approve', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + session.accessToken
          },
          body: JSON.stringify({ id })
        });
        if (res.status === 403) {
          showToast('Forbidden: Missing scope expense.approve');
        }
        return;
      }

      const res = await fetch('/api/expenses/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + session.accessToken
        },
        body: JSON.stringify({ id })
      });

      if (res.ok) {
        fetchExpenses();
      }
    }

    async function deleteExpense(id, hasPerm) {
      if (!hasPerm) {
        // Force endpoint call anyway to test backend security guard
        const res = await fetch('/api/expenses/delete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + session.accessToken
          },
          body: JSON.stringify({ id })
        });
        if (res.status === 403) {
          showToast('Forbidden: Missing scope expense.delete');
        }
        return;
      }

      const res = await fetch('/api/expenses/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + session.accessToken
        },
        body: JSON.stringify({ id })
      });

      if (res.ok) {
        fetchExpenses();
      }
    }
  </script>
</body>
</html>`;
}
