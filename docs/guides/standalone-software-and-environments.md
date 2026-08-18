# Standalone Software, Runtimes & Execution Environments

This guide provides a comprehensive breakdown of all self-contained runtimes, standalone binary utilities, containerized toolchains, and environment selection rules for the SG Forge platform.

---

## 🔒 Mandatory Core Principle: Zero Host Installation

> [!IMPORTANT]
> **NOTHING is to be installed on the developer's host operating system.**
> All compilers, runtimes, linters, security scanners, and analysis tools required by this project are 100% self-contained within this repository or packaged as isolated Docker containers.

Developers and AI agents MUST NEVER run system-level package installation commands (such as `apt-get install`, `npm install -g`, `pip install`, `brew install`, `pacman -S`, or modifying global system paths).

---

## 🧰 Standalone Software & Runtimes Inventory

The repository bundles all necessary software so that cloning the repository provides a complete, isolated environment.

### 1. Standalone Runtimes & Virtual Environments

| Runtime / Tool | Location in Repo | Primary Purpose | Invocation Command |
|---|---|---|---|
| **Bun 1.x** | `portables/bun/bin/bun` | High-performance JS/TS runtime, package runner, and bundler | `bun <script>` or `./run.sh portable dev` |
| **Node 26 LTS** | `.node_env/bin/node` | JS execution runtime wrapper | `.node_env/bin/node <script>` |
| **Python 3 Environment** | `./.venv/bin/python3` | Standalone Python virtual environment | `./.venv/bin/python3 <script>` |
| **MkDocs Documentation** | `./.venv/bin/mkdocs` | Material documentation builder and preview server | `./.venv/bin/mkdocs serve` |

### 2. Repo-Bundled Utility Portables (`portables/`)

| Utility Name | Binary Location | Purpose | Direct Command |
|---|---|---|---|
| **SCC** | `portables/bin/scc` | Source code counter (SLOC, blank lines, comments, complexity metrics) | `./scripts/code-matrix.sh` or `portables/bin/scc` |
| **Lizard** | `portables/bin/lizard` | Code complexity and cyclomatic complexity analyzer | `portables/bin/lizard core/src` |
| **Hyperfine** | `portables/bin/hyperfine` | CLI benchmarking tool for performance testing | `portables/bin/hyperfine 'bun test'` |
| **Tree** | `portables/bin/tree` | Visual directory tree visualizer | `portables/bin/tree -I 'node_modules|.git|.next'` |
| **Astryx** | `portables/bin/astryx` | Abstract Syntax Tree (AST) code structure analyzer | `portables/bin/astryx` |
| **Caveman** | `portables/bin/caveman` | Token compression wrapper for LLM responses | `portables/bin/caveman` |

### 3. Containerized Verification Toolchain (`toolchain/`)

All polyglot validation tools are packaged in the isolated `sgforge-toolchain` Docker container.

| Category | Utility | Target Scope | Purpose |
|---|---|---|---|
| **Linting** | **Biome** | TypeScript / JavaScript | Fast syntax validation, formatting, and linting |
| | **Ruff** | Python | Python microservice linting and formatting |
| | **golangci-lint** | Go | Comprehensive Go metalinter |
| | **SQLFluff** | SQL / Drizzle | SQL dialect style and lint enforcement |
| **Architecture** | **Dependency-Cruiser** | Monorepo structure | Checks boundary crossings across packages/microservices |
| **Security & Audit** | **Gitleaks** | Git repository | Scans commit history and codebase for leaked credentials |
| | **Trivy** | Filesystem & Lockfiles | Vulnerability scanner for dependencies and OS packages |
| | **Semgrep** | Source Code | Static Application Security Testing (SAST) |
| | **govulncheck** | Go Modules | Official Go vulnerability scanner |
| **Testing** | **Bun Test** | TS/JS Frontend & Backend | Unit and integration test runner with coverage reports |
| | **Go Test** | Go Apps / Services | Native Go test runner |

**Toolchain Invocation Commands:**
```bash
./run.sh toolchain all       # Run lint, security, test, and docs sequentially
./run.sh toolchain lint      # Run all linters (Biome, Ruff, golangci-lint, SQLFluff, boundary checks)
./run.sh toolchain format    # Auto-format codebases (Biome, Ruff)
./run.sh toolchain security  # Run Gitleaks, Trivy, Semgrep, and govulncheck
./run.sh toolchain test      # Execute test suites with coverage mapping
./run.sh toolchain docs      # Build documentation site with MkDocs inside container
```

---

## 🐳 Docker Setup vs Portable Boundaries

To optimize build speed, resource allocation, and environment isolation, clear boundaries define where **Docker** is strictly mandatory versus where **Portable** repo runtimes are permitted.

```
+-------------------------------------------------------------------------------+
|                             EXECUTION BOUNDARIES                              |
+---------------------------------------+---------------------------------------+
|          STRICTLY DOCKER              |            REPO PORTABLES             |
|  - Full Monorepo Multi-Service Stack  |  - Local Single-Service TS/JS Dev     |
|  - Production Sandbox Simulation       |  - Fast Unit Testing (Bun Test)       |
|  - Multi-Language Toolchain Auditing  |  - Local MkDocs Documentation Preview |
|  - Security & Vulnerability Scans     |  - SLOC & Complexity Metrics          |
+---------------------------------------+---------------------------------------+
```

### 1. STRICTLY DOCKER (Containerized Isolation Required)

Docker MUST be used for the following operations:

1. **Full-Stack Monorepo Development (`./run.sh docker dev`)**:
   - Launches all microservices (`reference-expenses`, `reference-python`, `reference-go`), PostgreSQL database (`5433`), Dev Dashboard (`3002`), Proxy Gateway (`3003`), and Next.js Portal (`3001`).
   - Uses BuildKit package cache mounts and explicit named volumes (`sgforge-root-node-modules`, `sgforge-frontend-node-modules`, `sgforge-next-cache`) to prevent disk bloat.

2. **Production Sandbox Simulation (`./run.sh docker sandbox`)**:
   - Runs the multi-stage compiled production release with zero volume bindings and non-root execution containers (`USER nextjs`/`appuser`).

3. **Multi-Language Verification Toolchain (`./run.sh toolchain [command]`)**:
   - Running linting across Go, Python, and SQL.
   - Executing SAST and vulnerability scans (Semgrep, Gitleaks, Trivy).

### 2. REPO PORTABLES (Local Process Execution Permitted)

Repo-bundled portables may be used directly for rapid feedback loops:

1. **Single-Service Frontend/Script Development (`bun` / `./run.sh portable dev`)**:
   - Pointing local `bun` processes to the containerized database (`docker compose -f docker/development/docker-compose.yaml up -d db`).

2. **Local Documentation Preview (`./.venv/bin/mkdocs serve`)**:
   - Serving live-reloading MkDocs documentation locally.

3. **Codebase Metrics & Complexity Analysis**:
   - Running `./scripts/code-matrix.sh`, `portables/bin/scc`, `portables/bin/lizard`, `portables/bin/hyperfine`, or `portables/bin/tree`.

4. **Pre-Commit Staging Check**:
   - Validating changes prior to commit via `./toolchain/run-precommit.sh`.

---

## ⚡ Quick Reference Commands for Developers & AI Agents

> [!NOTE]
> All bash commands executed by AI agents MUST be prefixed with `rtk` (e.g. `rtk ./run.sh docker dev`, `rtk bun test`).

```bash
# Launch entire dev stack in Docker
./run.sh docker dev

# Launch dev stack in portable mode (local bun + docker db)
./run.sh portable dev

# Stop all running containers and free ports 3001, 3002, 3003
./run.sh stop

# Prune containers, build caches, and temporary data
./run.sh clean

# Run verification toolchain (lint, security, test)
./run.sh toolchain all

# Run source code metrics (SLOC & file matrix)
./scripts/code-matrix.sh

# Run pre-commit checklist
./toolchain/run-precommit.sh

# Preview documentation locally
./.venv/bin/mkdocs serve
```
