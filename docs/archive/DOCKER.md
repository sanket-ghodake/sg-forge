# SG Forge Docker Deployment Guide

Using Docker and Docker Compose, you can launch SG Forge, its PostgreSQL database, and all test reference applications with a single command—with **zero host dependencies** (no local Node/Bun, Python, Go, or Postgres installations required).

---

## ⚡ Quick Start

### 1. Launch the Stack
From the project root directory, run:
```bash
docker-compose up --build
```
*(Or `docker compose up --build` depending on your Docker version)*.

### 2. Access the Applications
Once the containers are initialized and running, access the portal interfaces:
* **Host Portal UI:** [http://localhost:3001](http://localhost:3001)
* **Dev Dashboard / SQL Workbench:** [http://localhost:3002](http://localhost:3002)
* **Expenses Tracker Micro-App (Node):** [http://localhost:8085](http://localhost:8085)
* **Go Task Manager Micro-App:** [http://localhost:8086](http://localhost:8086)
* **Python Reference Documents App:** [http://localhost:8087](http://localhost:8087)

---

## 🏗 Container Architecture

The `docker-compose.yml` orchestrates two primary services:
1. **`db` (Postgres 15 alpine):** Standard, lightweight Postgres service. Includes a database health check to ensure it accepts client connections before the application boots. Persists database data across launches inside the `pgdata` volume.
2. **`app` (Multi-runtime Node/Bun/Go/Python container):** Builds the application using the project `Dockerfile`.
   * Executed by the `scripts/docker-entrypoint.sh` script.
   * Automatically waits for `db` to pass health checks.
   * Runs the database tables structure initializer (`bun run src/database/initialize-local-db.ts`).
   * Launches all portal services, reference micro-apps, and dev interfaces in parallel.

---

## 📊 Container Management Commands

### Run Integration Tests inside Docker
Verify the container's internal services are fully functional by executing the test suite directly inside the running container environment:
```bash
docker-compose exec app bun test test/
```

### Stop the Containers
Stop the services and preserve the database volume:
```bash
docker-compose down
```

### Reset Database State (Destructive)
Stop services and completely clear the database volume to start fresh:
```bash
docker-compose down -v
```

### View Application Logs
Stream logs from the portal and reference runtimes:
```bash
docker-compose logs -f app
```
