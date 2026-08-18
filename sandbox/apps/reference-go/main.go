package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	_ "github.com/lib/pq"
)

const PORT = 8086

type Config struct {
	DatabaseURL string
	PortalURL   string
}

var config Config
var db *sql.DB

type User struct {
	ID    string `json:"id"`
	Eid   string `json:"eid"`
	Name  string `json:"name"`
	Email string `json:"email"`
	Role  string `json:"role"`
}

type SessionData struct {
	AccessToken string   `json:"accessToken"`
	User        User     `json:"user"`
	Scopes      []string `json:"scopes"`
}

type Task struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Status    string    `json:"status"`
	UserName  string    `json:"user_name"`
	CreatedAt time.Time `json:"created_at"`
}

func initDB() {
	var err error
	db, err = sql.Open("postgres", config.DatabaseURL)
	if err != nil {
		log.Fatalf("Error opening database: %v", err)
	}

	// Wait for database connection and role readiness
	for i := 0; i < 30; i++ {
		err = db.Ping()
		if err == nil {
			break
		}
		log.Printf("Waiting for database connection and roles... (%d/30): %v", i+1, err)
		time.Sleep(1 * time.Second)
	}

	if err != nil {
		log.Fatalf("Could not connect to database: %v", err)
	}

	log.Println("[reference-go] Database connection established. Provisioning schema...")
	_, err = db.Exec("CREATE SCHEMA IF NOT EXISTS forge_reference_go")
	if err != nil {
		log.Printf("Schema creation error: %v", err)
	}

	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS forge_reference_go.tasks (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			title VARCHAR(255) NOT NULL,
			status VARCHAR(50) DEFAULT 'pending' NOT NULL,
			user_name VARCHAR(255) NOT NULL,
			created_at TIMESTAMP DEFAULT NOW() NOT NULL
		)
	`)
	if err != nil {
		log.Fatalf("Error creating tasks table: %v", err)
	}
	log.Println("[reference-go] Database schema provisioned successfully.")
}

func writePortalAuditLog(accessToken, action, severity string, payload map[string]interface{}) {
	bodyMap := map[string]interface{}{
		"action":   action,
		"severity": severity,
		"payload":  payload,
	}
	jsonBytes, err := json.Marshal(bodyMap)
	if err != nil {
		log.Printf("Error marshaling audit log: %v", err)
		return
	}

	req, err := http.NewRequest("POST", fmt.Sprintf("%s/api/v1/audit/log", config.PortalURL), bytes.NewBuffer(jsonBytes))
	if err != nil {
		log.Printf("Error creating request: %v", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+accessToken)

	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Error sending audit log: %v", err)
		return
	}
	defer resp.Body.Close()
}

func validateToken(accessToken string) (string, []string, bool) {
	var scopeStr string
	var userName string
	var expiresAt time.Time

	err := db.QueryRow(`
		SELECT u.name, t.scope, t.expires_at 
		FROM forge_access_tokens t
		JOIN users u ON t.user_id = u.id
		WHERE t.access_token = $1`, accessToken).Scan(&userName, &scopeStr, &expiresAt)

	if err != nil {
		return "", nil, false
	}

	if expiresAt.Before(time.Now()) {
		return "", nil, false
	}

	// Drizzle/postgres arrays might be stored as json string or pg array
	var scopes []string
	if strings.HasPrefix(scopeStr, "[") {
		_ = json.Unmarshal([]byte(scopeStr), &scopes)
	} else {
		// Try parsing postgres array format `{scope1,scope2}`
		cleaned := strings.Trim(scopeStr, "{}")
		if cleaned != "" {
			scopes = strings.Split(cleaned, ",")
		}
	}

	return userName, scopes, true
}

func hasScope(scopes []string, required string) bool {
	for _, s := range scopes {
		if s == required {
			return true
		}
	}
	return false
}

func getBearerToken(r *http.Request) string {
	authHeader := r.Header.Get("Authorization")
	if strings.HasPrefix(authHeader, "Bearer ") {
		return strings.TrimSpace(authHeader[7:])
	}
	return ""
}

func handleRoot(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}

	code := r.URL.Query().Get("code")
	var session *SessionData
	
	// 2026 Security Standards: Read credentials directly from environment variables if present
	clientID := os.Getenv("CLIENT_ID")
	clientSecret := os.Getenv("CLIENT_SECRET")

	if clientID == "" || clientSecret == "" {
		clientID = "client_reference_go" // Default fallback slug/id
		err := db.QueryRow("SELECT client_id, client_secret FROM forge_apps WHERE slug = 'reference-go'").Scan(&clientID, &clientSecret)
		if err != nil {
			log.Printf("Error getting credentials from database: %v", err)
		}
	}

	if code != "" {
		exchangeURL := fmt.Sprintf("%s/api/v1/auth/exchange", config.PortalURL)
		exchangeBody, _ := json.Marshal(map[string]string{
			"code":          code,
			"client_id":     clientID,
			"client_secret": clientSecret,
		})

		resp, err := http.Post(exchangeURL, "application/json", bytes.NewBuffer(exchangeBody))
		if err == nil {
			defer resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				var res SessionData
				if err := json.NewDecoder(resp.Body).Decode(&res); err == nil {
					session = &res
				}
			}
		}
	}

	tmpl := template.Must(template.New("dashboard").Parse(htmlTemplate))
	w.Header().Set("Content-Type", "text/html")
	
	var sessionJSON string
	if session != nil {
		bytes, _ := json.Marshal(session)
		sessionJSON = string(bytes)
	} else {
		sessionJSON = "null"
	}

	type TemplateData struct {
		SessionJSON string
		ClientID    string
	}

	_ = tmpl.Execute(w, TemplateData{
		SessionJSON: sessionJSON,
		ClientID:    clientID,
	})
}

func handleTasks(w http.ResponseWriter, r *http.Request) {
	token := getBearerToken(r)
	if token == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	userName, scopes, valid := validateToken(token)
	if !valid {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	if r.Method == http.MethodGet {
		if !hasScope(scopes, "user.profile.read") {
			writePortalAuditLog(token, "go.task.read.denied", "WARN", map[string]interface{}{"reason": "Missing profile read scope"})
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}

		rows, err := db.Query("SELECT id, title, status, user_name, created_at FROM forge_reference_go.tasks ORDER BY created_at DESC")
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		var tasks []Task
		for rows.Next() {
			var t Task
			if err := rows.Scan(&t.ID, &t.Title, &t.Status, &t.UserName, &t.CreatedAt); err == nil {
				tasks = append(tasks, t)
			}
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(tasks)

	} else if r.Method == http.MethodPost {
		if !hasScope(scopes, "user.profile.read") {
			writePortalAuditLog(token, "go.task.create.denied", "WARN", map[string]interface{}{"reason": "Missing profile scope"})
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}

		var body struct {
			Title string `json:"title"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		var t Task
		err := db.QueryRow(
			"INSERT INTO forge_reference_go.tasks (title, status, user_name) VALUES ($1, 'pending', $2) RETURNING id, title, status, user_name, created_at",
			body.Title, userName,
		).Scan(&t.ID, &t.Title, &t.Status, &t.UserName, &t.CreatedAt)

		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		writePortalAuditLog(token, "go.task.created", "INFO", map[string]interface{}{"title": body.Title})
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(t)
	}
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{
		"status":    "active",
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

func securityHeadersMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "SAMEORIGIN")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'self'; object-src 'none'; base-uri 'none';")
		next(w, r)
	}
}

func main() {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://lifeos:change_me_db_password@localhost:5432/org_db"
	}
	if !strings.Contains(dbURL, "sslmode=") {
		if strings.Contains(dbURL, "?") {
			dbURL += "&sslmode=disable"
		} else {
			dbURL += "?sslmode=disable"
		}
	}

	portalURL := os.Getenv("PORTAL_URL")
	if portalURL == "" {
		portalURL = "http://localhost:3001"
	}

	config = Config{
		DatabaseURL: dbURL,
		PortalURL:   portalURL,
	}

	initDB()

	http.HandleFunc("/", securityHeadersMiddleware(handleRoot))
	http.HandleFunc("/api/tasks", securityHeadersMiddleware(handleTasks))
	http.HandleFunc("/api/health", securityHeadersMiddleware(handleHealth))

	log.Printf("[reference-go] Listening on port %d...", PORT)
	// nosemgrep: go.lang.security.audit.net.use-tls.use-tls
	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%d", PORT), nil))
}


const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reference Go Task Manager</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090a0f;
      --panel: rgba(17, 18, 27, 0.7);
      --border: rgba(255, 255, 255, 0.08);
      --text: #f3f4f6;
      --text-muted: #9ca3af;
      --primary: #10b981;
      --primary-hover: #059669;
      --warning: #f59e0b;
      --danger: #ef4444;
      --glow: rgba(16, 185, 129, 0.15);
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
      background: linear-gradient(135deg, var(--primary), #3b82f6);
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
      background: rgba(245, 158, 11, 0.15);
      color: var(--warning);
    }
  </style>
</head>
<body>
  <div class="container">
    <div id="no-session" style="display: none; text-align: center; margin-top: 100px;">
      <h2 style="font-weight: 500; margin-bottom: 16px;">Connecting to SG Forge Session (Go app)...</h2>
      <div style="color: var(--text-muted); margin-bottom: 24px;">Please launch this application through the SG Forge Application Portal, or sign in below.</div>
      <button onclick="authorizeDirect()" class="btn" style="max-width: 280px; margin: 0 auto; display: block; background: linear-gradient(135deg, var(--primary), #3b82f6); box-shadow: 0 0 15px var(--glow);">Authorize via Org Manager</button>
    </div>

    <div id="session-active" style="display: none;">
      <header>
        <div class="brand">
          <div class="brand-logo">G</div>
          <h1>Go Reference Task Ledger</h1>
        </div>
        <div class="user-pill">
          <span class="status-dot"></span>
          <span id="user-display">Loading...</span>
        </div>
      </header>

      <div class="layout">
        <div class="card">
          <div class="card-title">New Go Task</div>
          <form id="task-form">
            <div class="form-group">
              <label for="title">Task Title</label>
              <input type="text" id="title" required placeholder="e.g. Verify Go runtime compile">
            </div>
            <button type="submit" class="btn">Add Task</button>
          </form>
        </div>

        <div class="card">
          <div class="card-title">Go Tasks Register</div>
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Owner</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="ledger-body">
              <tr>
                <td colspan="3" style="text-align: center; color: var(--text-muted);">Fetching tasks...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <script>
    const session = {{.SessionJSON}};
    const clientId = "{{.ClientID}}";

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

      fetchTasks();

      document.getElementById('task-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('title').value;

        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + session.accessToken
          },
          body: JSON.stringify({ title })
        });

        if (res.ok) {
          document.getElementById('title').value = '';
          fetchTasks();
        }
      });
    }

    async function fetchTasks() {
      const res = await fetch('/api/tasks', {
        headers: { 'Authorization': 'Bearer ' + session.accessToken }
      });
      if (res.ok) {
        const tasks = await res.json();
        const body = document.getElementById('ledger-body');
        if (!tasks || tasks.length === 0) {
          body.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">No tasks recorded.</td></tr>';
          return;
        }
        body.innerHTML = '';
        tasks.forEach(t => {
          const tr = document.createElement('tr');
          tr.innerHTML = '<td>' + t.title + '</td><td>' + t.user_name + '</td><td><span class="badge">' + t.status + '</span></td>';
          body.appendChild(tr);
        });
      }
    }
  </script>
</body>
</html>`
