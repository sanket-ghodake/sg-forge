# SG Forge Security Guidelines

This document outlines the security architecture, threat mitigations, and best practices implemented within SG Forge.

---

## 🎯 Threat Model & Mitigations

### 1. Privilege Escalation & Access Control
* **Threat:** Standard employees (e.g. designation L3 software engineer) attempt to access administrative micro-applications (e.g. Nexus IT Provisioning) or call administrative APIs.
* **Mitigation:**
  * SG Forge runs a strict hierarchical RBAC permission engine.
  * Next.js middleware (`proxyGuard.ts` and `authGuard.ts`) intercepts requests to apps `/forge-apps/[slug]` and APIs `/api/forge-apps/[slug]`.
  * Target rules in `app.json` (verticals, designations, min job levels) are cross-checked on every request against the authenticated user session.

### 2. Cross-Frame Vulnerabilities (Iframe Sandboxing)
* **Threat:** A compromised or malicious third-party micro-app tries to read host session cookies, hijack the browser's top-level navigation, or execute cross-site scripting (XSS) on the portal domain.
* **Mitigation:**
  * All apps are loaded inside standard `<iframe>` elements with strict sandboxing attributes:
    ```html
    <iframe src="..." sandbox="allow-scripts allow-forms" />
    ```
  * By omitting `allow-same-origin`, the micro-app is treated as a distinct cross-origin site. It cannot access portal cookies, localStorage, or the parent DOM.
  * By omitting `allow-top-navigation`, the micro-app is blocked from redirecting the parent window.

### 3. Session Hijacking & Cookie Security
* **Threat:** Intercepting session details via client scripts or man-in-the-middle network snooping.
* **Mitigation:**
  * Sessions are encrypted using `iron-session` (AES-256-GCM symmetric encryption).
  * Session cookies are configured as `HttpOnly` (preventing document.cookie reads), `Secure` (HTTPS-only in production), and `SameSite=Lax` (blocking CSRF access).

---

## 🗄 Database Isolation & Protection

### 1. Read-Only Connections (`roDb`)
For general analytical queries and database views, the system uses a dedicated connection pool (`roDb`) distinct from write connections:
* On connection, the pool automatically locks the session state:
  ```sql
  SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;
  ```
* Any attempt to perform `INSERT`, `UPDATE`, `DELETE`, or `DROP` operations throws a database-level driver exception.

### 2. SQL Workbench Sandbox Restrictions
The administrative SQL Workbench endpoint (`/api/query`):
* Enforces role-based query execution (restricting raw queries to `super_admin`, `admin`, and `read_only_admin` roles).
* Standard standard-user (`user`) requests are rejected with a `403 Forbidden` response.
* Queries executed by `read_only_admin` sessions are checked against destructive command keywords (`drop`, `delete`, `truncate`, `update`, `insert`, `alter`) and blocked at the engine layer if any match.
