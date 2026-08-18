# Docker Environment

Using Docker and Docker Compose, you can launch the SG Forge platform, its PostgreSQL database, and all test reference applications with a single command—with **zero host dependencies** (no local Bun, Python, Go, or Postgres installations required).

---

## ⚡ Quick Start

### 1. Launch the Stack
You can launch the containers in development or production mode using our runner script:

*   **Development Mode**: Mounts local directories for hot-reloading and loads `config/envs/docker.development.env`.
    ```bash
    ./run.sh docker dev
    ```
*   **Production Mode**: Builds the production bundle and loads `config/envs/docker.production.env`.
    ```bash
    ./run.sh docker sandbox
    ```

### 2. Access the Applications
Once the containers are running, the following ports will be mapped on your host:
*   **Host Portal UI**: [http://localhost:3001](http://localhost:3001)
*   **Dev Dashboard**: [http://localhost:3002](http://localhost:3002)
*   **Developer Proxy Gateway**: [http://localhost:3003](http://localhost:3003)
*   **Postgres Database (Direct)**: port `5433` (as defined in `docker-compose.yaml` port mapping under the development or production config)

## 🏷️ Dynamic `.env` Namespacing & White-labeling

You can completely rebrand and namespace all containers, networks, and persistent volumes directly from your environment file:

```env
# config/envs/docker.development.env
COMPOSE_PROJECT_NAME=mycompany
PROJECT_NAME=mycompany
APP_ENV=development
```

When started, all containers, networks, and volumes are automatically generated with your custom namespace:
*   **Database Container**: `mycompany-development-db`
*   **Portal Container**: `mycompany-development-portal`
*   **Microservices**: `mycompany-development-expenses`, `mycompany-development-go`, etc.
*   **Docker Network**: `mycompany-network`
*   **Database Volume**: `mycompany-pgdata`

---

## 🏗 Container Architecture

The project contains two distinct Docker configurations separated into development and production folders for clarity and optimization:

1. **Development Environment (`docker/development/`)**:
   - Dockerfile and Docker Compose mount the host workspace (`../..:/app`) with node_modules overrides.
   - It supports hot-reloading (via `bun --watch` and Next.js dev server).
   - The Docker image does NOT copy source code or compile Next.js at build time, resulting in extremely fast container generation.
2. **Production Environment (`docker/production/`)**:
   - Dockerfile uses multi-stage builds (Go compiling in `go-builder`, Next.js bundling in `js-builder`) to produce a highly optimized, minimal final image with no Go compiler or build dependencies.
   - No host directories are mounted, ensuring absolute sandbox isolation.
   - Run services (Dashboard, Expenses, Python, Proxy, Next.js) in optimized production runtimes.

---

## 📊 Container Management Commands

### Run Tests inside Docker (Development)
Verify container services are fully operational by executing the test suite directly inside the running development container environment:
```bash
docker compose -f docker/development/docker-compose.yaml exec app bun run test
```

### Stop the Containers (Development)
Stop the services and preserve database tables:
```bash
docker compose -f docker/development/docker-compose.yaml down
```

### Reset Database State (Development - Destructive)
Stop services and completely clear the database volume to start fresh:
```bash
docker compose -f docker/development/docker-compose.yaml down -v
```

---

## 🔌 Microservice Lifecycle & Native App Integration

The Dev Center Dashboard allows developer monitoring and control of the workspace application ecosystem. Apps are classified into two distinct types:

### 1. Isolated Lifecycle Apps
*   **Examples**: `reference-expenses`, `reference-go`, `reference-python`, `telemetry-dashboard`.
*   **Architecture**: Run as independent, standalone Docker containers alongside the main portal.
*   **Dashboard Controls**: Full start, stop, and restart controls are enabled. In Docker mode, these execute commands directly against their corresponding container (e.g. `docker start reference-go`).
*   **Health Checks**: Periodically pinged on their target URL (e.g. `/api/health`).

### 2. Natively Integrated Apps
*   **Examples**: `manager-operations`, `employees`, `billing`.
*   **Architecture**: Bundled and executed natively as client-side React modules within the core Portal container. They do not run separate processes or contain separate Docker containers.
*   **Dashboard Controls**: Lifecycle action buttons are disabled with the label `Natively Integrated (Portal Managed)` as they are implicitly online when the portal is running.
*   **Health Checks**: Automatically marked as `ACTIVE` by the health monitoring worker without querying any endpoints.

### ⚠️ Troubleshooting Container Control Issues
If a container is not running or not found in the environment:
*   **Action API**: Rejects requests with `404 Not Found` or `400 Bad Request` instead of triggering a server-side 500 error.
*   **Logs API**: Gracefully returns a message stating the container is not found/running, preventing unhandled exceptions.


