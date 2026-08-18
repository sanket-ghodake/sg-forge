# SG Forge (Modular Corporate Portal Engine) - v0.1.0

SG Forge is an installable, stable, and extensible organizational workspace portal and secure sandboxing engine. It enables organizations to orchestrate internal micro-frontends (Forge Apps) written in any language (Go, Python, TypeScript) under strict sandbox boundaries and unified, stateless authentication.

---

## 🚀 1-Command Quick Start & Developer Onboarding

Any developer can clone the repo and run **one single command** to bootstrap the entire environment (zero host package installations required):

```bash
./run.sh setup
```
*This automatically checks Docker daemon status, configures localized Bun runtimes, creates isolated container networks, spins up the database, initializes schemas, and builds required SDK assets.*

### 🛠 System Diagnostics & Monitoring
*   **Run System Pre-flight Doctor**:
    ```bash
    ./run.sh doctor
    ```
*   **Inspect Live Stack Status & Memory Usage**:
    ```bash
    ./run.sh status
    ```
*   **Tail Container Logs**:
    ```bash
    ./run.sh logs app        # Tail core app logs
    ./run.sh logs db         # Tail database logs
    ```

---

## 💻 Platform Execution Modes

All execution targets and environments are run via the central orchestrator script: **`./run.sh`**.

### 🐳 1. Docker Setup (Zero-dependency Containerized Runtime)
Run the entire platform, PostgreSQL database, and microservices in isolated containers with auto-restart on reboot.

*   **Development Mode (Hot-Reloading & Live Loading)**:
    ```bash
    ./run.sh docker dev
    ```
*   **Production Sandbox Mode (Statically Compiled & Isolated)**:
    ```bash
    ./run.sh docker sandbox
    ```

For details on configuration and commands, see the [Docker Optimization Guide](file:///home/sanket/Desktop/Sanket/org_website/docs/guides/docker_optimization.md) and [Docker Environment Guide](file:///home/sanket/Desktop/Sanket/org_website/docs/guides/docker.md).

---

### 💻 2. Portable Setup (Local Host Runtime)
Runs application services natively on your host machine using workspace-isolated runtimes (`portables/bun`).

*   **Start Local Dev Servers**:
    ```bash
    ./run.sh portable dev
    ```

For detailed instructions, see the [Installation & Setup Guide](file:///home/sanket/Desktop/Sanket/org_website/docs/guides/installation.md) and the [Orchestration Scripts Guide](file:///home/sanket/Desktop/Sanket/org_website/scripts/README.md).

### 🌐 3. Edge Reverse Proxy & Dynamic Project Hub (Ports 80 & 443)
Runs a high-performance reverse proxy layer with TLS/SSL encryption and dynamic app routing.

*   **Project Landing Dashboard**: `http://localhost/` or `https://localhost/` (Port 80/443 root)
*   **Main Portal Routing**: `http://localhost/portal` &rarr; Port 3001
*   **DevCenter Routing**: `http://localhost/devcenter` &rarr; Port 3002
*   **Gateway Proxy Routing**: `http://localhost/gateway` &rarr; Port 3003
*   **Dynamic Apps Auto-Discovery**: `http://localhost/apps/:slug/` &rarr; Auto-maps to respective sandbox port (e.g. `:8085`, `:8086`, `:8087`, etc.)
*   *Note: Direct service ports (3001, 3002, 3003, 8085-8090) remain 100% open and unaffected for granular developer testing.*

---

### ⚡ 4. Custom App Development & "Vibe Coding"
Scaffold and run a new micro-frontend app instantly with zero manual configuration.

*   **Scaffold App Boilerplate**:
    ```bash
    bun run create-app "My New App" --lang=ts
    ```
    This automatically scans for allocated ports, assigns the next free port, and generates files under `sandbox/apps/my-new-app/`.
*   **Run Platform Dev Servers**:
    ```bash
    ./run.sh docker dev     # Or ./run.sh portable dev
    ```
*   **Hot-Reload & Live Logs**: Code changes in `sandbox/apps/` refresh automatically. Monitor live logs and database tables at the **Developer Dashboard** (`http://localhost:3002`).

---

## ⚙️ System Independence & Performance Optimizations

### 1. System Independence
*   **Docker Setup**: Fully system-independent. Any developer with Docker and Docker Compose installed on their host system (Linux, macOS, or Windows/WSL2) can execute the run scripts, and it will build and run identically. The build context is completely isolated and does not rely on local node dependencies or absolute host file paths.
*   **Portable Setup**: System-independent for Linux and macOS. The `setup.sh` script dynamically detects the host operating system architecture and downloads the correct portable Bun runtime binary (currently Bun v1.3.14). It then configures local workspace node dependencies and sets up a containerized database before natively starting the frontend and helper microservices.

### 2. Optimization (Storage & Time)
*   **Docker Environment**:
    *   **Size (Storage)**: Fully optimized down to **510MB** for the production bundle using multi-stage builds (`node:20-bookworm-slim`). Production containers run directly from precompiled static build assets and do not mount heavy host volumes.
    *   **Speed (Time)**: Rebuilt the development database container to run with optimized write parameters (`fsync=off`, `synchronous_commit=off`, `full_page_writes=off`). This brought the database seed script completion time from **12+ seconds** down to **less than 1 second**.
*   **Portable Environment**:
    *   **Size (Storage)**: Extremely light since it runs natively on the host filesystem with no container virtualization overhead.
    *   **Speed (Time)**: Utilizing the updated Bun v1.3.14 runtime engine, compilation of the production Next.js static files and routes completed in a blazing fast **4.6 seconds**.

---

## 🛠 Validation Toolchain

Run tests, security checks, linter suites, and document compilers inside the Dockerized toolchain:

*   **Run All Validation Checks**:
    ```bash
    ./run.sh toolchain all
    ```
*   **Run Lint & Format Checks**:
    ```bash
    ./run.sh toolchain lint
    ```
*   **Execute Test Suite with Coverage**:
    ```bash
    ./run.sh toolchain test
    ```
*   **Build the Documentation Site (MkDocs)**:
    ```bash
    ./run.sh toolchain docs
    ```

---

---

## 📊 Code Details & Metrics Matrix (True Source Code)

> *Metrics compiled using `scc` excluding node_modules, portables, `.next` build caches, and compiled browser bundle outputs (`dashboard.js`, `forge-sdk.js`).*

| Language | Files | Lines | Blank | Comment | Code (SLOC) | Complexity |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TypeScript** | 137 | 37,260 | 3,420 | 1,178 | **32,662** | 5,991 |
| **Markdown** | 100 | 6,965 | 1,414 | 0 | **5,551** | 0 |
| **JavaScript (Config/Scripts)** | 6 | 7,138 | 806 | 252 | **6,080** | 923 |
| **CSS** | 3 | 2,773 | 269 | 49 | **2,455** | 0 |
| **JSON** | 28 | 2,425 | 0 | 0 | **2,425** | 0 |
| **HTML** | 3 | 1,359 | 129 | 115 | **1,115** | 0 |
| **Shell** | 16 | 1,340 | 231 | 131 | **978** | 229 |
| **Python** | 3 | 707 | 56 | 40 | **611** | 55 |
| **YAML / Config** | 8 | 683 | 47 | 4 | **632** | 0 |
| **Go** | 1 | 600 | 55 | 5 | **540** | 76 |
| **Dockerfile** | 9 | 261 | 63 | 50 | **148** | 8 |
| **Total** | **325** | **61,897** | **6,501** | **1,858** | **53,538** | **7,283** |

---


## 📁 Project Documentation & Architecture

Active design specifications, guidelines, and setup documentations are organized in the `docs/` folder:

*   **[Dev vs Production Scaling Guide](file:///home/sanket/Desktop/Sanket/org_website/docs/guides/dev-vs-production-scaling.md)**: Real-world reference guide for scaling SG Forge (100+ apps, 100,000+ concurrent traffic, read/write DB splitting, CDN edge caching, and memory caps).
*   **[Onboarding Analysis Guide](file:///home/sanket/Desktop/Sanket/org_website/docs/guides/onboarding_analysis.md)**: Real evaluation of setup portability, platform quirks, and developer onboarding friction points.
*   **[App Integration & Prototyping](file:///home/sanket/Desktop/Sanket/org_website/docs/guides/app-integration.md)**: Step-by-step tutorial for integrating internal (zero-port-exposure) and externally hosted microservices, using scaffolding scripts, and "Vibe Coding" hot-reloading configurations.
*   **[Installation & Setup](file:///home/sanket/Desktop/Sanket/org_website/docs/guides/installation.md)**: Bootstrapping host databases and runtime engines.
*   **[App Developer Specs](file:///home/sanket/Desktop/Sanket/org_website/docs/guides/app-developer.md)**: Detailed specifications for app manifests, API schemas, and utilizing parent communication SDKs.
*   **[Docker Architecture](file:///home/sanket/Desktop/Sanket/org_website/docs/guides/docker.md)**: Container services overview and ports mapping.
*   **[Docker Optimization](file:///home/sanket/Desktop/Sanket/org_website/docs/guides/docker_optimization.md)**: Multi-stage environment builds and parity structures.
*   **[WSL Setup Guide](file:///home/sanket/Desktop/Sanket/org_website/docs/guides/wsl.md)**: Port forwarding and systemd networking inside WSL2.
*   **[Script Folders Overview](file:///home/sanket/Desktop/Sanket/org_website/scripts/README.md)**: List of convenience scripts and utility functions.

### 🔍 Core Files to Check:
*   **App Scaffolder CLI**: [scripts/create-forge-app.ts](file:///home/sanket/Desktop/Sanket/org_website/scripts/create-forge-app.ts) — Unused port scanning and workspace bootstrapping.
*   **Central Orchestrator**: [run.sh](file:///home/sanket/Desktop/Sanket/org_website/run.sh) — Starts platform targets (Docker or Portable) and containerized linting/testing toolchains.
*   **Local Installer Setup**: [scripts/portable/development/setup.sh](file:///home/sanket/Desktop/Sanket/org_website/scripts/portable/development/setup.sh) — Downloads isolated bun binaries and seeds local database.
*   **Proxy Gateway**: [scripts/developer-proxy.ts](file:///home/sanket/Desktop/Sanket/org_website/scripts/developer-proxy.ts) — Internal routing without exposing ports.
*   **Dynamic App Runner**: [scripts/dynamic-app-runner.ts](file:///home/sanket/Desktop/Sanket/org_website/scripts/dynamic-app-runner.ts) — Background runner scanning directory structure.
*   **Manifest Sync Engine**: [core/src/backend/utils/manifestParser.ts](file:///home/sanket/Desktop/Sanket/org_website/core/src/backend/utils/manifestParser.ts) — Automated app registry parser, schema provisioning, and cleanup.
*   **OAuth Auth Exchange**: [core/src/frontend/app/api/v1/auth/exchange/route.ts](file:///home/sanket/Desktop/Sanket/org_website/core/src/frontend/app/api/v1/auth/exchange/route.ts) — Handles backend code exchange for secure JWT session tokens.

