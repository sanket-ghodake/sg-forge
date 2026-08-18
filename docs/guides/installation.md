# Installation & Setup

Follow these steps to set up and launch the SG Forge platform on your local machine (Linux/WSL/macOS).

---

## 📋 Prerequisites & Zero Host Install Directive

> [!IMPORTANT]
> **Zero Host Installation Policy**: Nothing is to be installed on your local host system. All compilers, runtimes, linters, and analysis tools are bundled locally (`portables/`, `./.venv/`) or run inside Docker containers (`toolchain/`). See [Standalone Software & Environments Guide](standalone-software-and-environments.md) for full details.

### 1. Requirements
*   **Git**: Required to clone the repository.
*   **Docker Engine / Desktop**: Required for container orchestration, database isolation, and verification toolchains.
*   **Systemd / Boot Persistence (Recommended)**:
    Ensure Docker is enabled to auto-start on boot:
    ```bash
    sudo systemctl enable --now docker containerd
    ```

---

## 🚀 1-Command Automated Installation (Recommended)

Any developer can bootstrap the full project with a single command:

```bash
# 1. Clone repository
git clone https://github.com/sanket-ghodake/org_manager.git sgforge
cd sgforge

# 2. Run automated onboarding
./run.sh setup
```

The `./run.sh setup` script automatically:
1. Verifies Docker engine status and systemd auto-start configuration.
2. Auto-downloads localized `portables/bun` runtime if not present.
3. Installs all workspace dependencies (`bun install`).
4. Creates isolated Docker networks (`sgforge-network`, `sgforge-portal-net`, `sgforge-db-core-net`).
5. Launches PostgreSQL database container and executes automated schema seeds.
6. Compiles Forge SDK and Dev Dashboard browser client bundles.

---

## 🔍 System Verification & Diagnostics

Run the built-in system doctor to verify environment readiness, available memory, disk space, and port allocations:

```bash
./run.sh doctor
```

Inspect live container health and memory consumption:
```bash
./run.sh status
```

---

## 🏃‍♂️ Launching the Development Stack

### A. Docker Mode (Full Containerized Stack)
Builds and runs all core services and micro-apps in isolated Docker containers:
```bash
./run.sh docker dev
```

### B. Portable Mode (Fast Local Dev Runtime)
Runs Node/Bun processes directly on host with isolated Bun runtime and containerized database:
```bash
./run.sh portable dev
```

Once started:
*   **Portal UI**: `http://localhost:3001`
*   **Dev Dashboard**: `http://localhost:3002`
*   **Developer Proxy Gateway**: `http://localhost:3003`
