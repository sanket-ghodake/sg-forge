# Zero-Host-Install Portable Developer & Agent Ecosystem

The SG Forge platform implements a strict **Zero-Host-Install** architecture. Developers and AI agents can clone the repository on any operating system and immediately develop, test, run AI agents, and pass all pre-commit gates without running package managers against the host operating system (`no apt-get`, `no brew`, `no pip install`, `no npm -g`).

---

## 1. Operating System Compatibility Matrix

| Operating System | Architecture | Primary Shell | Bootstrap Command | Execution Engine |
| :--- | :--- | :--- | :--- | :--- |
| **Linux (Ubuntu, Debian, Fedora, Arch, Alpine)** | x86_64 / aarch64 | `bash` / `zsh` | `./run.sh setup` | Native Portable Bun / Local `.venv` / Docker |
| **macOS (Apple Silicon M1/M2/M3/M4)** | arm64 | `zsh` / `bash` | `./run.sh setup` | Native Darwin Bun / Local `.venv` / Docker |
| **macOS (Intel)** | x86_64 | `zsh` / `bash` | `./run.sh setup` | Native Darwin Bun / Local `.venv` / Docker |
| **Windows 10 / 11 (WSL 2)** | x86_64 / arm64 | `bash` | `./run.sh setup` | WSL Linux Portable Subsystem |
| **Windows 10 / 11 (Native)** | x86_64 | PowerShell / `cmd` | `scripts\portable\development\setup.bat` | Win64 Portable Bun / `.venv` / `run.bat` |

---

## 2. 1-Command Developer Onboarding

### Linux & macOS (macOS Apple Silicon & Intel)
```bash
# 1. Clone the repository
git clone https://github.com/sanket-ghodake/org_manager.git
cd org_manager

# 2. Run automated bootstrap
./run.sh setup

# 3. Launch development environment
./run.sh dev portable   # Fast local Bun stack (Ports 3001, 3002, 3003)
# OR
./run.sh dev docker     # 100% containerized live-reload stack
```

### Windows (Native PowerShell or CMD)
```cmd
:: 1. Clone repository
git clone https://github.com/sanket-ghodake/org_manager.git
cd org_manager

:: 2. Run Windows automated portable setup
scripts\portable\development\setup.bat

:: 3. Launch stack
scripts\portable\development\run.bat
```

---

## 3. Directory Layout & Portable Runtimes

All dependencies and runtimes reside strictly inside the repository workspace:

```
org_website/
├── portables/                     # Local standalone binaries & runtimes (Zero Host)
│   ├── bun/bin/bun                # Standalone Bun runtime binary
│   ├── rtk/bin/rtk                # RTK token optimizer binary
│   ├── bin/                       # Unified executable wrappers
│   │   ├── rtk                    # Universal RTK runner wrapper
│   │   ├── graphify               # Knowledge graph AST engine wrapper
│   │   ├── caveman                # Token compression wrapper
│   │   ├── lizard                 # Cyclomatic complexity analyzer wrapper
│   │   ├── scc                    # High-speed lines-of-code counter
│   │   ├── tree                   # Structure visualizer
│   │   ├── hyperfine              # Benchmarking CLI
│   │   └── astryx                # TypeScript/JavaScript AST engine
│   └── caveman/                   # Local Caveman source & bundles
├── .venv/                         # Isolated Python virtualenv (Zero Host Pip)
│   ├── bin/ruff                   # Fast Python linter/formatter
│   ├── bin/sqlfluff               # SQL dialect linter & formatter
│   ├── bin/semgrep                # AST-based static application security scanner
│   ├── bin/mkdocs                 # Documentation site generator
│   └── bin/graphify               # Graphify knowledge engine
├── node_modules/                  # Local TypeScript dependencies (Biome, TS, Depcruise)
├── toolchain/                     # Containerized fallback toolchain
│   ├── Dockerfile                 # Multi-tool verification image
│   ├── docker-compose.yml         # Container runner
│   └── run-precommit.sh           # Enterprise multi-layer pre-commit gate
└── run.sh                         # Unified orchestrator & platform CLI
```

---

## 4. AI Agent Toolkit Integration

AI agents (Google DeepMind Antigravity, Claude Code, GitHub Copilot) leverage local portable wrappers automatically:

### RTK (`rtk`)
- **Location**: `portables/bin/rtk`
- **Role**: Automatically wraps terminal execution to compress noisy command outputs and reduce token consumption by up to 70%.
- **Usage**: `rtk git status`, `rtk bun test`, `rtk next build`.

### Graphify (`graphify`)
- **Location**: `portables/bin/graphify`
- **Role**: Builds an AST-driven navigable knowledge graph of code symbols, god nodes, and communities stored in `graphify-out/`.
- **Usage**: `graphify query "<concept>"`, `graphify path "<A>" "<B>"`.

### Caveman (`caveman`)
- **Location**: `portables/bin/caveman`
- **Role**: Compresses assistant messages into high-density technical facts, saving up to 65% of context window space.
- **Usage**: `caveman <file>`.

---

## 5. Enterprise Pre-Commit Quality & Security Gates

Every `git commit` triggers `toolchain/run-precommit.sh` through `.husky/pre-commit`:

```
git commit
   │
   ├── Layer 0: Instant In-Memory Hygiene (< 20ms)
   │   ├── Block un-templated secrets (.env, .pem, .key, id_rsa, .sqlite)
   │   ├── File size threshold (< 1024 KB)
   │   ├── Git merge conflict markers
   │   └── Trojan Source & BiDi Unicode injection check (CVE-2021-42574)
   │
   ├── Layer 1: Local AST & Style Linters (< 500ms)
   │   ├── Biome (Formatting & Linting) via portable Bun
   │   ├── TypeScript Compiler (`tsc --noEmit`)
   │   ├── Ruff (Python Linting) via local `.venv`
   │   ├── SQLFluff (SQL Validation) via local `.venv`
   │   └── Dependency Cruiser (Architectural boundaries)
   │
   └── Layer 2: Deep Security & Containerized Fallback
       ├── Gitleaks secret entropy scanning
       ├── Semgrep static security patterns
       ├── Trivy vulnerability audit
       └── Fallback to `docker compose -f toolchain/docker-compose.yml` if local tools absent
```

---

## 6. Pre-Flight Diagnostics (`./run.sh doctor`)

To verify that your local environment is fully configured and ready:

```bash
./run.sh doctor
```

Example diagnostic output:
```text
═══════════════════════════════════════════════════════════════════════
                 SG FORGE SYSTEM PRE-FLIGHT DOCTOR                     
═══════════════════════════════════════════════════════════════════════

• Active Namespace: sg-forge (Environment: dev)
• Docker Engine Status: Active & Accessible
• Docker Reboot Persistence (systemd): Enabled (Auto-starts on reboot)
• Localized Portable Toolchain & AI Agents:
   - Bun Runtime: 1.3.14 (/home/sanket/Desktop/Sanket/org_website/portables/bun/bin/bun)
   - RTK Token Optimizer: Ready (/home/sanket/Desktop/Sanket/org_website/portables/bin/rtk)
   - Graphify Knowledge Engine: Ready (/home/sanket/Desktop/Sanket/org_website/portables/bin/graphify)
   - Caveman Token Reducer: Ready (portables/bin/caveman)
   - Isolated Python .venv: Active (.venv/bin/python3)
     └ Linters & Scanners: ruff sqlfluff semgrep mkdocs lizard
   - Analysis Binaries: scc tree astryx hyperfine
• Available System RAM: 15320 MB (Sufficient)
• Available Disk Space: 84G
• Application Port Allocations:
   - Port 3001: Free
   - Port 3002: Free
   - Port 3003: Free
   - Port 5433: Free
   - Port 8085: Free
   - Port 8086: Free
   - Port 8087: Free
   - Port 8080: Free
• Environment Configuration Files:
   - config/envs/docker.development.env: Present
   - config/envs/docker.production.env: Present
   - config/envs/portable.development.env: Present

✓ All core platform prerequisites are in optimal state.
```

---

## 7. Troubleshooting & FAQ

### Q: Why not install `bun`, `ruff`, or `rtk` via `sudo apt` or `brew`?
**A:** System-wide package installs lead to cross-machine version drift, permission conflicts, and pollution of developer workstations. Bundling everything portably ensures identical execution behavior on developer laptops, CI/CD runners, and Docker containers.

### Q: What if a developer is offline after cloning?
**A:** If network access was available during the initial clone and `./run.sh setup`, all binaries are stored in `portables/`, `.venv/`, and `node_modules/`. The entire development lifecycle runs 100% offline.

### Q: Can I run checks manually before committing?
**A:** Yes:
```bash
./toolchain/run-precommit.sh
```
