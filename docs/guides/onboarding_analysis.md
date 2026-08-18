# Onboarding, Setup, and Forge App Integration Portability Analysis

This document provides a comprehensive, honest analysis of the developer onboarding experience, runtime execution flows, and sandboxed application (Forge App) integration mechanics on the SG Forge platform.

---

## 📊 1. Executive Summary & Ratings

| Dimension | Rating | Description |
| :--- | :--- | :--- |
| **Docker-Based Onboarding** | **9.5 / 10** | **Excellent.** Zero host dependencies (except Docker & Git). The `./run.sh` script automates compilation, database migrations, data seeding, and reverse proxy networking. |
| **Portable (Host-Based) Setup** | **8.0 / 10** | **Very Good.** Restricts Node/Bun dependency pollution via workspace-isolated runtimes (`portables/bun`). Requires host tooling (Go, Python) if running all sample micro-apps natively. |
| **Cross-Platform Portability** | **8.5 / 10** | Full container compatibility for macOS, Linux, and Windows (via WSL2/Docker). Port configurations and CRLF scripts are pre-optimized via `.gitattributes`. Native Windows host execution (outside WSL2/Docker) is not supported. |
| **Forge App Integration (Internal)** | **9.0 / 10** | **Highly Automated.** Simply dropping a folder inside `sandbox/apps/` automatically registers, proxies, processes, and provisions isolated database schemas on startup or user log-in. |
| **Forge App Integration (External)** | **8.5 / 10** | Bypasses CORS/iframe constraints cleanly via `routingMode: standalone`. Backchannel OAuth exchange is robust and standard. |

---

## 💻 2. Onboarding & Running the Repository

The codebase offers two distinct paths for getting the portal running, ensuring flexibility depending on the developer's system setup.

### A. Docker Setup (Zero-Dependency Path)
*   **The Experience**: Extremely smooth. By running `./run.sh docker dev` (development with hot-reloading) or `./run.sh docker sandbox` (production build simulation), the orchestrator builds the container images, spins up PostgreSQL, seeds mock organizational data from `company_data.json`, and starts the Next.js portal, dev dashboard, and backend services.
*   **Aesthetics & Usability**: The CLI helper (`run.sh`) features clean ANSI colors and an interactive prompt if run without arguments.
*   **CI Parity**: Linting, formatting, security checks, and testing are fully containerized under `toolchain/`. Running `./run.sh toolchain all` executes the exact same verification locally as the GitHub Actions pipeline (`.github/workflows/ci.yml`), eliminating the "works on my machine" class of bugs.

### B. Portable Setup (Local Host Runtime Path)
*   **The Experience**: Runs natively on the host filesystem for maximum speed (e.g., Next.js production builds compile in ~4.6 seconds on Bun v1.3.14).
*   **No Dependency Pollution**: The setup script downloads a local portable Bun binary into `portables/bun/bin` and updates the PATH variables for execution, preventing global system package contamination.
*   **System Dependencies**: Still relies on a containerized Postgres instance (which it automatically spawns in Docker in detached mode) to avoid requiring a local Postgres database configuration.

### ⚠️ Onboarding Friction Points & Gotchas
1.  **Native Windows Execution**: Running `./run.sh portable dev` natively inside Windows CMD or PowerShell (without WSL2) is not supported, as it relies on bash scripts. Windows developers **must** use WSL2 or run in full Docker mode.
2.  **Port Collisions**: The portal maps several ports on the host system:
    *   `3001` (Core Portal UI)
    *   `3002` (Dev Dashboard)
    *   `3003` (Developer Proxy Gateway)
    *   `5433` (Postgres DB)
    If a developer already has a server listening on any of these ports (especially port 5433 for local Postgres), startup will fail.
3.  **WSL2 Service Configuration**: Inside WSL2, background database daemons may not automatically run. The project documents this in `docs/guides/wsl.md`, recommending `wsl.conf` adjustments or manual commands.

---

## 🛠️ 3. Forge App Integration Mechanics

SG Forge excels in its design for onboarding new micro-frontends (Forge Apps) into the workspace.

### A. Internal Sandbox Applications (Plug & Play)
To add a new micro-app, a developer only needs to create a directory under `sandbox/apps/<app-slug>` containing:
1.  `app.json` (Manifest file declaring slug, metadata, RBAC access roles, target rules, and schema).
2.  An application server file (`server.ts`, `server.js`, `server.py`, `main.py`, or `main.go`).

#### Automation Features:
*   **Dynamic Discovery**: On startup, the portal dynamically scans `sandbox/apps/` subdirectories. If a valid `app.json` is found, the application is registered.
*   **Automatic Synchronization**: On user dashboard access or login, the portal runs `syncAppsToDatabase()`, syncing manifests and clearing obsolete registries without requiring manual SQL seeding.
*   **Zero-Port Exposure Proxy**: The developer proxy gateway (`developer-proxy.ts` on port 3003) maps `/forge-apps/<slug>` to the internal app container. Developers do not need to edit `docker-compose.yaml` files or expose their app's listener port to the host system.
*   **Automatic Database Schema Isolation**: If the app manifest requests it (`requiresIsolatedSchema: true`), the platform automatically provisions a dedicated schema namespace (e.g., `CREATE SCHEMA IF NOT EXISTS forge_my_app`) in PostgreSQL.

### B. SSO Integration (OAuth Handshake)
Decoupled apps communicate with the main portal using an OAuth 2.0 backchannel code exchange (`POST /api/v1/auth/exchange`) to fetch user sessions, JWTs, and scopes, ensuring zero-trust isolation.

### ⚠️ Integration Friction Points & Gotchas
1.  **Network Interface Binding (`0.0.0.0`)**: A common developer mistake is binding custom servers to loopback interfaces (`127.0.0.1` or `localhost`). Within Docker containers, this makes the app unreachable by the host gateway proxy. Custom servers **must bind to `0.0.0.0`**. (This is documented, but remains a common trap for new developers).
2.  **Required Ready Signal**: If the app's client-side frontend does not call the SDK method `forge.notifyReady()`, the portal's iframe stays stuck showing a loading spinner.
3.  **Client Secret Configuration**: If a developer omits the `clientId` and `clientSecret` from `app.json`, the portal generates random keys and stores them in the database. The developer then has to extract them from the database to configure their app's environment variables. Defining them explicitly in `app.json` is recommended.
4.  **Local Toolchains in Portable Mode**: If running in Portable mode, running Go or Python apps natively requires local installation of the Go compiler or Python interpreter on the developer's host machine.

---

## 💡 4. Key DX (Developer Experience) Recommendations

To lower the onboarding barrier even further, consider the following enhancements:

1.  **Local Port Customization**: Allow port overrides via environment variables in a root `.env` or config file to easily avoid port conflicts.
2.  **SDK Manifest Generator CLI**: Introduce a simple scaffolding CLI (e.g., `bun run forge init <app-slug>`) that creates the directory structure, writes the default `app.json` with a secure client secret, and seeds a template server file pre-bound to `0.0.0.0`.
3.  **Active Host Check**: Add a pre-flight checker script in `./run.sh` that checks if ports 3001, 3002, 3003, and 5433 are occupied, warning the developer before starting services.
