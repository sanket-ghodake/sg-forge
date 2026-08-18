# Docker Environment Scripts (`scripts/docker/`)

This directory contains execution wrappers to start the SG Forge Platform inside Docker containers.

## 📁 Directory Structure

```
scripts/docker/
├── README.md                  # This file
├── development/
│   ├── run.sh                 # Start containerized dev stack (live loading)
│   └── run.bat                # Start containerized dev stack on Windows
└── production/
    ├── run.sh                 # Start containerized production sandbox
    └── run.bat                # Start containerized production sandbox on Windows
```

---

## 🚀 Execution Instructions

### 1. Run Development Environment (Hot-Reloading)
Boots the stack using `docker/development/docker-compose.yaml`, mounting your local repository context so that file changes reflect instantly inside the container.

- **Linux / macOS**:
  ```bash
  ./scripts/docker/development/run.sh
  ```
- **Windows**:
  ```cmd
  scripts\docker\development\run.bat
  ```

### 2. Run Production Environment (Sandbox)
Compiles Go/Next.js/Python microservices inside multi-stage Docker builds (`docker/production/`) and spins up the compiled production images.

- **Linux / macOS**:
  ```bash
  ./scripts/docker/production/run.sh
  ```
- **Windows**:
  ```cmd
  scripts\docker\production\run.bat
  ```
