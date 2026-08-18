# Developer Setup Guide — Org Website (2026 Standalone Stack)

> **Who is this for?**
> This guide is written for developers and AI agents working on **Org Website**. It documents the 2026 technology stack, standalone portable runtime management, environment scripts, and static analysis tools.

---

## 1. 2026 Technology Stack Overview

| Component | Framework / Technology | Version (2026 Baseline) | Standalone Location |
| :--- | :--- | :--- | :--- |
| **JS / TS Engine** | Portable Bun / Node.js | **Node 26 LTS** / Bun 1.x | `portables/bun`, `.node_env/` |
| **Frontend Framework** | Next.js | **v16.2.9** | `node_modules/next` |
| **UI Library** | React | **v19.2.4** | `node_modules/react` |
| **ORM & Database** | Drizzle ORM + PostgreSQL | **v0.45.2** | `node_modules/drizzle-orm` |
| **Doc Generator** | MkDocs | Python 3.12+ | `.venv/bin/mkdocs` |
| **Type Checker** | TypeScript | **v5.x** | `node_modules/typescript` |

---

## 2. Portable Runtimes & Zero-Host-Pollution Strategy

To ensure reproducible builds across different development environments without host OS package conflicts, `org_website` utilizes standalone portable runtimes:

- **Bun Runtime (`bun`)**: Portable JavaScript / TypeScript execution engine and package manager stored in `portables/bun/bin/bun`.
- **Node.js 26 LTS (`.node_env/`)**: Portable Node.js standalone runtime stored in `.node_env/bin/node`.
- **Python Virtualenv (`./.venv/`)**: Isolated Python environment for MkDocs documentation (`./.venv/bin/mkdocs`).
- **Portable Executables (`portables/`)**: Standalone binary distributions isolated inside repository folders.

All setup and run commands automatically target these repository-local environments.

---

## 3. Standalone Runtime Setup Commands

### Step 1 — Setup Portable Bun Runtime (`portables/bun`)

```bash
bash scripts/portable/development/setup.sh
```

Or manually via curl:
```bash
mkdir -p portables/bun
curl -fsSL https://bun.sh/install | BUN_INSTALL=$(pwd)/portables/bun bash
export PATH="$(pwd)/portables/bun/bin:$PATH"
bun install
```

---

### Step 2 — Setup Standalone Node.js 26 LTS (`.node_env/`)

```bash
# Linux (x64)
python3 -c '
import urllib.request
url = "https://nodejs.org/dist/v26.0.0/node-v26.0.0-linux-x64.tar.xz"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
with urllib.request.urlopen(req) as resp, open("/tmp/node.tar.xz", "wb") as f:
    f.write(resp.read())
' && rm -rf .node_env && mkdir -p .node_env && tar -xJf /tmp/node.tar.xz -C .node_env --strip-components=1 && rm /tmp/node.tar.xz
```

```bash
# macOS (Apple Silicon arm64)
curl -fsSL https://nodejs.org/dist/v26.0.0/node-v26.0.0-darwin-arm64.tar.gz -o node.tar.gz
rm -rf .node_env && mkdir -p .node_env
tar -xzf node.tar.gz -C .node_env --strip-components=1 && rm node.tar.gz
```

---

### Step 3 — Setup Portable Python 3.12 Virtualenv (`.venv/`)

```bash
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt || ./.venv/bin/pip install mkdocs mkdocs-material
```

---

## 4. Standalone Code Analysis, Benchmarking & Tooling Setup

All code analysis, benchmarking, design system, and token optimization tools are installed strictly isolated inside `./portables/bin/` with ZERO system/host machine dependencies:

| Tool | Purpose | Executable Path | Execution Example |
| :--- | :--- | :--- | :--- |
| **`scc`** | Code Statistics & Language Breakdown | `./portables/bin/scc` | `./portables/bin/scc .` |
| **`lizard`** | Cyclomatic Complexity Analyzer (CCN ≤ 10) | `./portables/bin/lizard` | `./portables/bin/lizard -C 10 core/ packages/` |
| **`tree`** | Project Hierarchy Visualizer | `./portables/bin/tree` | `./portables/bin/tree -L 3` |
| **`hyperfine`** | Build & Test Benchmarker | `./portables/bin/hyperfine` | `./portables/bin/hyperfine 'bun test test/unit'` |
| **`astryx`** | Meta Design System CLI | `./portables/bin/astryx` | `./portables/bin/astryx status` |
| **`caveman`** | Token Compression CLI | `./portables/bin/caveman` | `./portables/bin/caveman status` |

### Tooling Execution Examples:

```bash
# 1. Code Statistics & SLOC breakdown
./portables/bin/scc .

# 2. Function Cyclomatic Complexity check
./portables/bin/lizard -C 10 core/ packages/

# 3. Project Directory Visualizer
./portables/bin/tree -L 3

# 4. Command Benchmark
./portables/bin/hyperfine --runs 3 './portables/bin/scc .'
```


---

## 5. Worklog Audit System & Hooks

The workspace implements a token-efficient, git-tracked audit trail in `logs/WORKLOGS.md`.

- **Log Appender Hook**: `./.agents/hooks/append-log.sh`
- **Usage**:
  ```bash
  ./.agents/hooks/append-log.sh "installed standalone dependencies and configured agent rules"
  ```
- **Log Format**: `YYYY-MM-DD HH:mm | <brief summary>`

---

## 6. Multi-IDE Instruction Synchronization

To ensure AI agent behavior is identical across Antigravity, Claude Code, GitHub Copilot, Cursor, and OpenCode:

- Master file: `AGENTS.md`
- Synchronization command:
  ```bash
  chmod +x .agents/scripts/sync-agent-instructions.sh
  ./.agents/scripts/sync-agent-instructions.sh
  ```

---

## 7. Development Commands Summary

```bash
# Run local dev environment
./run.sh dev

# Run unit tests
bun test test/unit

# Sync agent instructions across IDEs
./.agents/scripts/sync-agent-instructions.sh

# Append task summary to worklogs
./.agents/hooks/append-log.sh "your log message"
```
