# Docker Configuration & Microservice Architecture (`docker/`)

This directory contains the Docker container configurations and orchestrations for the SG Forge Platform, separated into **development**, **production**, and **toolchain** environments.

---

## ⚡ What is Docker BuildKit (`DOCKER_BUILDKIT=1`)?

**BuildKit** is Docker's next-generation container build engine. Setting `export DOCKER_BUILDKIT=1` replaces the legacy single-threaded Docker builder with a parallel, graph-based builder (DAG).

### How BuildKit Works Under the Hood

```
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│ 🚀 DOCKER BUILDKIT ENGINE MECHANISMS                                                      │
├───────────────────────────┬───────────────────────────────┬───────────────────────────────┤
│ 1. DAG Parallelization    │ 2. Persistent Cache Mounts    │ 3. Intelligent Skip Logic     │
│ Evaluates un-dependent    │ `--mount=type=cache` retains  │ Skips untouched stages        │
│ multi-stage targets in    │ package manager caches        │ entirely without evaluating   │
│ parallel threads.         │ across host builds.           │ unused Dockerfile instructions.│
└───────────────────────────┴───────────────────────────────┴───────────────────────────────┘
```

1. **DAG (Directed Acyclic Graph) Execution**:
   - Legacy Docker executes lines sequentially from line 1 to N.
   - BuildKit analyzes dependencies between stages (e.g., `go-builder` vs `js-builder`) and executes them **simultaneously in parallel**, cutting overall build time by 60–80%.

2. **Persistent Cache Mounts (`--mount=type=cache`)**:
   - Allows package managers (`bun`, `go mod`, `apt`, `pip`, `npm`) to maintain persistent download/compilation caches across docker builds outside container layers.
   - Even if `package.json` or `go.mod` changes, cached binary packages are fetched locally from `/root/.bun/install/cache` or `/go/pkg/mod` rather than re-downloaded over the network.

3. **Selective Context Transfer**:
   - BuildKit sends only the files actually required by `COPY` instructions rather than uploading the full workspace directory to the daemon.

---

## 📁 Directory Structure

```
docker/
├── development/
│   ├── Dockerfile             # Development container definition (Alpine + Bun watch mode)
│   ├── docker-compose.yaml    # Dev compose with volume mounts & hot-reloading
│   └── entrypoint.sh          # Dev bootstrapper (applies migrations, starts dev servers)
├── production/
│   ├── Dockerfile             # Multi-stage production container (Compiled Next.js + Go)
│   ├── docker-compose.yaml    # Production compose with zero host volume bindings
│   └── entrypoint.sh          # Production bootstrapper (runs compiled standalone server)
└── README.md                  # This file
```

---

## 🚀 Execution & Microservice Target Commands

All builds and runtimes are orchestrated via `./run.sh`.

### 1. Targeted Microservice Builds (`./run.sh build <service>`)

Build specific microservice containers in isolation without rebuilding the full monorepo:

```bash
# Enable BuildKit (Recommended in shell profile)
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# Build ONLY SG Forge Portal / Dashboard Container (~30s)
./run.sh build app

# Build ONLY Go Microservice Container (~10s)
./run.sh build reference-go

# Build ONLY Expenses Microservice Container (~15s)
./run.sh build reference-expenses

# Build ALL Microservices in Parallel
./run.sh build
```

---

### 2. Selective Execution Commands (`./run.sh docker dev [services...]`)

* **Run Portal + Postgres DB only** (saves RAM/CPU):
  ```bash
  ./run.sh docker dev app db
  ```

* **Run Entire Stack (Dev Mode with Hot-Reloading)**:
  ```bash
  ./run.sh docker dev
  ```

* **Run Production Sandbox Mode (Compiled Standalone Runtimes)**:
  ```bash
  ./run.sh docker sandbox
  ```

* **Stop Platform Containers**:
  ```bash
  ./run.sh stop
  ```

* **Prune Build Caches & Dangling Layers**:
  ```bash
  ./run.sh clean
  ```

---

## 📊 Container Port & Resource Mapping

| Service Name | Host Port | Internal Port | Memory Limit | Build Context |
| :--- | :--- | :--- | :--- | :--- |
| **`app` (SG Portal & Dev-Dashboard)** | `3001`, `3002`, `3003` | 3001, 3002, 3003 | 1024M | Root Monorepo |
| **`db` (PostgreSQL 15)** | `5433` | 5432 | 256M | Official Image |
| **`reference-expenses`** | `8085` | 8085 | 256M | `sandbox/apps/reference-expenses` |
| **`reference-go`** | `8086` | 8086 | 128M | `sandbox/apps/reference-go` |
| **`reference-python`** | `8087` | 8087 | 256M | `sandbox/apps/reference-python` |
| **`telemetry-dashboard`** | `8080` | 8080 | 256M | `sandbox/apps/telemetry-dashboard` |

---

## 🛡️ High Availability (HA) Architecture Guidelines

1. **Zero Blast Radius**: Use targeted microservice builds (`./run.sh build <service>`) so single microservice changes never trigger monolithic system rebuilds.
2. **Reverse Proxy API Gateway**: Route external traffic through Traefik/NGINX on ports 80/443 with TLS termination and rate-limiting.
3. **Rolling Deployments**: Deploy containers with `deploy.replicas: 3` and `order: start-first` to guarantee 0% downtime during updates.
4. **Health Probe Separation**:
   - `Liveness Probe` (`/healthz/live`): Checks container event loop.
   - `Readiness Probe` (`/healthz/ready`): Checks DB pool & internal service readiness before routing requests.
5. **Stateless Scale & DB Splitting**: Keep container sessions stateless via Redis; route read queries to `DATABASE_READONLY_URL` across PostgreSQL replicas.
