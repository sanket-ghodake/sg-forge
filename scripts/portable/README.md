# Portable Native Environment Scripts (`scripts/portable/`)

This directory contains scripts to configure and run the SG Forge Platform natively on your host machine (using a local isolated Bun/Node installation).

## 📁 Directory Structure

```
scripts/portable/
├── README.md                  # This file
├── development/
│   ├── run.sh                 # Start local development server (live reloading)
│   ├── run.bat                # Start local development server on Windows
│   ├── setup.sh               # Initialize portable bun, dependencies, & DB
│   └── setup.bat              # Initialize portable bun, dependencies, & DB on Windows
└── production/
    ├── run.sh                 # Start local production build & server
    └── run.bat                # Start local production build & server on Windows
```

---

## 🚀 Execution Instructions

### 1. One-Time Local Setup
Before running the native stack, you must download the isolated portable runtimes and configure the database schema:

- **Linux / macOS**:
  ```bash
  ./scripts/portable/development/setup.sh
  ```
- **Windows**:
  ```cmd
  scripts\portable\development\setup.bat
  ```

### 2. Run Development Environment
Runs Next.js, developer proxies, and microservices natively with hot-reloading (live loading).

- **Linux / macOS**:
  ```bash
  ./scripts/portable/development/run.sh
  ```
- **Windows**:
  ```cmd
  scripts\portable\development\run.bat
  ```

### 3. Run Production Environment
Compiles Next.js workspace packages into production-ready bundles and executes them locally.

- **Linux / macOS**:
  ```bash
  ./scripts/portable/production/run.sh
  ```
- **Windows**:
  ```cmd
  scripts\portable\production\run.bat
  ```

---

## 🛠️ Standalone Portable Tooling (`portables/bin/`)

Zero host pollution. Executables located strictly inside `portables/bin/`:

- `./portables/bin/scc`: Code statistics analyzer
- `./portables/bin/lizard`: Cyclomatic complexity calculator
- `./portables/bin/tree`: Repository directory visualizer
- `./portables/bin/hyperfine`: CLI benchmark runner
- `./portables/bin/astryx`: Meta Astryx design system CLI
- `./portables/bin/caveman`: Token compression controller

