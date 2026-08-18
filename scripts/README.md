# Orchestration & Helper Scripts (`scripts/`)

This directory contains convenience wrappers, bootstrappers, and developer utility scripts to set up, run, and maintain the SG Forge Platform.

---

## 🧭 Portable Setup vs. Docker Setup: Clear Distinction

The SG Forge Platform supports two execution models. Each has its own dependencies and use cases:

### 1. Portable Setup (Local Host Execution)
*   **What it is**: Runs the application microservices (Next.js Frontend, Go backend, Python backend, Proxy Gateway) natively on your host machine's runtime. It relies on a local portable version of `bun` to avoid dirtying your system-wide environment.
*   **When to use**: When you want maximum performance, fast local debugger access, or need to run processes locally without virtualized docker container overhead.
*   **Dependencies**: Only Docker is needed to host the PostgreSQL database in the background. Runtimes (Bun/Node) are download-isolated to the workspace.

### 2. Docker Setup (Fully Containerized Execution)
*   **What it is**: Runs the entire application stack—both database and all application services—fully containerized.
*   **When to use**: When you want a 100% reproducible development environment with zero local runtime dependencies.
*   **Dependencies**: Docker & Docker Compose only. No Go, Node, Bun, Python, or PostgreSQL are required on your host machine.

---

## 🏃 Setup & Running Instructions

The root orchestrator script `./run.sh` acts as the primary gateway to execute both setups.

### 🛠 Option A: Running the Portable Setup

1.  **Initialize Portable Runtimes & Dependencies**:
    Execute the local bootstrapper from the project root:
    ```bash
    # On Linux/macOS:
    ./scripts/setup.sh

    # On Windows:
    scripts\setup.bat
    ```
    *This downloads the portable Bun runtime into `portables/bun/`, runs `bun install` locally, and seeds the local database schema.*

2.  **Start the Local Stack**:
    Use the orchestrator to start the local processes:
    ```bash
    ./run.sh portable dev
    ```
    *This spins up PostgreSQL in a background Docker container and runs the Next.js portal, Proxy Gateway, and microservices natively on your host machine with live-reloading.*

---

### 🐳 Option B: Running the Docker Setup

No runtime installations are required. Simply boot the stack from the root directory:

1.  **Start Development Environment (with Hot-Reloading)**:
    ```bash
    ./run.sh docker dev
    ```
    *Spins up all microservices and Next.js under the dev target (`docker/development/`), mounting your host source directory for live-loading.*

2.  **Start Production Sandbox Environment (Statically Compiled)**:
    ```bash
    ./run.sh docker sandbox
    ```
    *Builds production artifacts through isolated multi-stage Docker builds and runs the optimized production stack.*

---

## 📂 Script Inventory & Purpose

Below is a map of the helper scripts located in this folder:

*   **`setup.sh` / `setup.bat`**: Bootstraps the portable environment, installs local `bun`, and runs local schema seeding.
*   **`run-dev.sh`**: Natively executes the local dev portal, reference expenses app, and developer proxy gateway concurrently (used by `./run.sh portable dev`).
*   **`developer-proxy.ts`**: Backchannel routing proxy to bridge portal traffic to individual microservices during development.
*   **`replace-relative-imports.py`**: Utility to automatically rewrite relative import statements into tidy absolute imports.
