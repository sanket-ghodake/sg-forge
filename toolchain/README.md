# SG Forge Verification Toolchain

This directory houses the containerized verification toolchain for the SG Forge platform. It bundles all necessary runtimes (Node, Bun, Go, Python) and analysis tools into a single container image to ensure linting, formatting, security auditing, and test executions run identically on developer machines and CI pipelines.

---

## 🛠 Included Tools & Multi-Tier Gates

The toolchain packages analysis utilities and zero-overhead pre-commit gates across three execution tiers:

| Tier | Category | Tool / Check | Target Scope | Purpose & Guarantees |
|---|---|---|---|---|
| **Layer 0** | **Instant Hygiene (<20ms)** | **Blocklist & Mode Guards** | Staged files | Blocks `.env*`, `*.pem`, `id_rsa`, `*.sqlite`, >1MB files, invalid `chmod +x` |
| **Layer 0** | **Security Integrity** | **Trojan Source Scanner** | Staged diffs | Prevents invisible Bidi unicode override attacks (CVE-2021-42574) |
| **Layer 0** | **Architectural Hygiene** | **Relative Import Guard** | Staged TS/JS | Rejects relative imports (`./`, `../`) in favor of clean aliases (`@/...`) |
| **Layer 0** | **Production Hygiene** | **Debugger Artifact Blocker** | Staged TS/JS/Py | Blocks stray `debugger;`, `breakpoint()`, or `pdb.set_trace()` |
| **Layer 0** | **Agent Alignment** | **Directive Sync Guard** | Agent rules | Enforces synchronization across IDE instruction sets (Rule 9) |
| **Layer 1** | **Linting & Code Style** | **Biome** | TypeScript / JavaScript | Rust-native fast syntax validation, linting, and formatting |
| | | **Ruff** | Python | High-speed linting and formatting with `.ruff_cache` |
| | | **golangci-lint** | Go | Metalinter for Go codebase |
| | | **SQLFluff** | SQL / Drizzle | SQL dialect linting and style enforcement |
| | **Architectural Integrity**| **Dependency-Cruiser**| Monorepo structure | Checks boundary crossings (e.g. preventing frontend from importing backend directly) |
| **Layer 2** | **Security & Secrets** | **Gitleaks** | Git repository | Scans commit history and files for leaked secrets, credentials, or keys |
| | | **Trivy** | Filesystem & Lockfiles | Dependency vulnerability scanner for lockfiles |
| | | **Semgrep** | Source Code | Static Application Security Testing (SAST) |
| | | **govulncheck** | Go Modules | Official vulnerability scanner for Go |
| | **Type & Testing** | **TypeScript (`tsc`)** | TypeScript codebase | Incremental compiler type safety check on staged modules |
| | | **Bun Test** | TS/JS / Core Portal | Unit and integration test runner with coverage reports |
| | | **Go Test** | Go Apps / Services | Native unit tests |

---

## 📊 Resource & Performance Benchmarks

Measured using Linux GNU `time -v` (Peak Resident Set Size):

| Scenario | Staged Scope | Peak RAM (RSS) | CPU Impact | Wall Clock |
| :--- | :--- | :--- | :--- | :--- |
| **Clean Pre-Commit Check** | 0 files | **4.9 MB** | < 1% CPU | `< 10 ms` |
| **Layer 0 In-Memory Guards** | Diff streams | **12.4 MB** | ~2% CPU | `< 25 ms` |
| **Standard Feature Commit** | 1–5 files | **28.5 – 39.6 MB** | Brief burst | `< 600 ms` |
| **Full Initial Monorepo Commit** | 313 files / 60k SLOC | **395 MB** | Multi-core 86% | `~50.9 s` |

---

## 🚀 How to Run

Verification commands should be run using the orchestrator script in the workspace root, which will automatically build the toolchain container and execute the relevant validation suite.

### Standard Commands

Always run from the workspace root:

```bash
# Run all checks (linting, security, and tests)
./run.sh toolchain all

# Run linters and boundary checks only
./run.sh toolchain lint

# Auto-format all source code
./run.sh toolchain format

# Run security audits (secrets, Trivy, and Semgrep)
./run.sh toolchain security

# Execute test suites with coverage
./run.sh toolchain test
```

### Direct Docker Compose Usage

If you prefer to run commands directly via `docker compose`:

```bash
# Build the toolchain container
docker compose -f toolchain/docker-compose.yml build toolchain

# Run checks
docker compose -f toolchain/docker-compose.yml run --rm lint
docker compose -f toolchain/docker-compose.yml run --rm format
docker compose -f toolchain/docker-compose.yml run --rm security
docker compose -f toolchain/docker-compose.yml run --rm test
```

---

## 📂 File Structure

* `Dockerfile`: Declares the Debian-based environment containing Go, Node, Bun, Python, and all scanning tools.
* `docker-compose.yml`: Defines the toolchain services, volume mounts, and network configurations.
* `run-checks.sh`: The entrypoint shell script inside the container that dispatches to the requested checker.
