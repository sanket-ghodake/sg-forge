# SG Forge Release Notes - v0.1.0

SG Forge version **v0.1.0** is the initial public release of our plug-and-play organizational workspace portal and secure sandboxing application engine.

---

## 🚀 Key Highlights

* **Secure Iframe Sandbox Container:** Standardized isolation parameters preventing cross-site scripting (XSS), cookie snooping, and top-level DOM manipulation by third-party micro-apps.
* **Stateless OAuth-Style Authentication Handshake:** Fully decoupled, database-agnostic token exchange mechanism enabling applications built in any programming language to securely authenticate with the host portal.
* **Multi-Language Reference Apps:** End-to-end reference applications provided in **Go**, **Python 3**, and **Node/Bun/TypeScript** demonstrating access control, custom PostgreSQL schemas, and audit logging.
* **Hierarchical RBAC Permission Engine:** Relational database role resolving using recursive Postgres Common Table Expressions (CTE).
* **Administrative SQL Workbench:** Built-in SQL execution interface with read-only connection pool enforcement (`roDb`), role locks, and query keyword filtering.
* **Dynamic Theme Propagation:** Real-time design theme matching between host portal and nested iframes via client PostMessage events.
* **Docker Ready:** Complete, zero-dependency containerization configuration with Postgres 15 database health checks.

---

## 📦 System Dependencies Matrix
* **Portal Engine:** Next.js v16.2.9, React v19.2.4
* **Runtime Orchestration:** Bun v1.2.0 (bundled or local)
* **Database Driver:** Drizzle ORM v0.30.0, Node Postgres (`pg`) v8.11.0
* **Required Languages (Dev):** Python v3.x, Go v1.x, Node/Bun v1.x
* **Deployment Container:** Docker Engine (Compose v3.8+)
