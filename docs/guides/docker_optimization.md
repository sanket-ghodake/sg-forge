# Docker Setup Optimization & Multi-Stage Environment Architecture

The SG Forge Platform Docker setup has been restructured and optimized to drastically reduce image sizes, speed up build times, support hot-reloading in development, prevent disk storage exhaustion, and enforce sandboxed compilation in production.

---

## 🏗 Key Architectural Decisions

We separated the legacy single-stage Docker configuration into two distinct target environments:

```
docker/
├── development/
│   ├── Dockerfile
│   ├── docker-compose.yaml
│   └── entrypoint.sh
└── production/
    ├── Dockerfile
    ├── docker-compose.yaml
    └── entrypoint.sh
```

---

## 🛠 Storage, RAM & Build Speed Solutions Implemented

### 1. Storage & Volume Protection
- **Named Volumes**: Replaced anonymous volume hashes with explicit named volumes (`sgforge-root-node-modules`, `sgforge-frontend-node-modules`, `sgforge-next-cache`). Anonymous volumes generated unreferenced hash directories in `/var/lib/docker/volumes/` on every boot; named volumes recycle disk storage cleanly.
- **Log Rotation Limits**: Configured container log rotation limits (`max-size: 10m`, `max-file: 3`) across all services in `docker-compose.yaml`, stopping log files from expanding infinitely in `/var/lib/docker/containers/`.
- **Automated Pruning**: Enhanced `./run.sh clean` to run `docker builder prune -f` alongside `docker system prune -f` for BuildKit layer cleanup.

### 2. RAM Memory Resource Caps
- Added strict memory resource limits (`deploy.resources.limits.memory`) across all development containers to prevent host RAM exhaustion:
  - `app` (Next.js / Node / Bun): **1024MB RAM** (with `NODE_OPTIONS=--max-old-space-size=512`)
  - `db` (PostgreSQL 15): **256MB RAM**
  - `reference-expenses`: **256MB RAM**
  - `reference-python`: **256MB RAM**
  - `telemetry-dashboard`: **256MB RAM**
  - `reference-go`: **128MB RAM**

### 3. Build Speed & Cache Preservation
- **Preserved Dev Cache**: Removed `rm -rf core/src/frontend/.next` from `docker/development/entrypoint.sh`. Deleting `.next` on every boot forced cold recompilations; preserving it accelerates container startup from minutes to seconds.
- **BuildKit Package Cache**: Added `--mount=type=cache,target=/root/.bun/install/cache` to the `bun install` stage in `docker/development/Dockerfile`.
- **Disabled Polling**: Set `WATCHPACK_POLLING=false` in dev compose to prevent high host disk write I/O and CPU spikes.
- **Manifest Accuracy**: Corrected manifest `COPY` instructions in Dockerfile to copy exact monorepo manifests (`core/package.json`, `packages/sdk/package.json`).

### 4. Self-Starting Reboot Persistence & Self-Healing
- **Restart Policies**: Configured `restart: unless-stopped` on all services (including `db`) across dev and production compose files. If the host machine or Docker daemon reboots, all containers automatically recover without manual operator intervention.
- **Healthcheck Synchronization**: Dependent microservices wait for PostgreSQL health (`condition: service_healthy`), ensuring error-free startup ordering.

### 5. Production Security Hardening
- **Unprivileged Runtime Execution**: Production Dockerfiles run under non-root users (`USER bun`) to prevent host privilege escalation.
- **Docker Socket Isolation**: The host Docker socket (`/var/run/docker.sock`) is removed from production runtime containers.
- **Localhost Database Binding**: Database ports are bound strictly to `127.0.0.1:5433:5432` to avoid exposing the database to the public network.

---

## ⚡ Development vs. Production Breakdown

| Feature / Metric | Development Environment (`docker/development/`) | Production Environment (`docker/production/`) |
| :--- | :--- | :--- |
| **Hot-Reloading** | Yes (watches source files via `bun --watch` and Next.js dev server) | No (compiled/standalone assets run on production servers) |
| **Host Volume Mounts** | Yes (`../..:/app` maps local codebase with named volume overrides) | No (complete container sandbox isolation for security) |
| **RAM Resource Cap** | Enforced per container (e.g. `1024M` app, `256M` DB) | Enforced per container (`768M` app, `256M` DB) |
| **Log Rotation** | Strict limits (`max-size: 10m`, `max-file: 3`) | Strict limits (`max-size: 10m`, `max-file: 3`) |
| **Reboot Policy** | `restart: unless-stopped` | `restart: unless-stopped` |
| **Security User** | `root` (dev tooling) | `USER bun` (non-root unprivileged) |
| **Build Optimization** | Fast BuildKit layer caching and named volume cache | Multi-stage builder stages (`go-builder` & `js-builder`) |
| **Go Code Execution** | On-the-fly execution via `go run main.go` | Pre-compiled binary `./reference-go-bin` (no Go SDK in runtime image) |
| **Next.js Execution** | Development server (`next dev`) with hot-reloading | Optimized production standalone bundle (`next start`) |

---

## 🛠 Dockerized Toolchain & CI/CD Pipeline

All validation checks are containerized inside the toolchain container:

- **Linting & Formatting**: `./run.sh toolchain lint`
- **Security Audit**: `./run.sh toolchain security`
- **Tests with Coverage**: `./run.sh toolchain test`
- **Docs Generation**: `./run.sh toolchain docs`
- **All Checks**: `./run.sh toolchain all`

---

## 📊 Developer Operations Cheat Sheet

### Lifecycle & Bootstrap
* **1-Command Setup**:
  ```bash
  ./run.sh setup
  ```
* **System Diagnostic Doctor**:
  ```bash
  ./run.sh doctor
  ```
* **Stack Health & Memory Monitor**:
  ```bash
  ./run.sh status
  ```
* **Tail Container Logs**:
  ```bash
  ./run.sh logs [app|db|reference-expenses|...]
  ```

### Run the Stack
* **Start Development (with live reload & memory caps)**:
  ```bash
  ./run.sh docker dev
  ```
* **Start Production Sandbox (fully compiled)**:
  ```bash
  ./run.sh docker sandbox
  ```
* **Stop All Containers**:
  ```bash
  ./run.sh stop
  ```
* **Prune Storage & Build Caches**:
  ```bash
  ./run.sh clean
  ```
