#!/usr/bin/env bash
# Sync Agent Instructions across Antigravity, Claude Code, GitHub Copilot, Cursor, and OpenCode/Codex

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

AGENTS_FILE="$REPO_ROOT/AGENTS.md"
DOT_AGENTS_FILE="$REPO_ROOT/.agents/AGENTS.md"
CLAUDE_FILE="$REPO_ROOT/CLAUDE.md"
COPILOT_FILE="$REPO_ROOT/.github/copilot-instructions.md"

echo "Syncing agent instruction files in $REPO_ROOT..."

# 1. Sync AGENTS.md to .agents/AGENTS.md
cp "$AGENTS_FILE" "$DOT_AGENTS_FILE"
echo "  [✓] Synced AGENTS.md -> .agents/AGENTS.md"

# 2. Sync core directives to CLAUDE.md
cat << 'EOF' > "$CLAUDE_FILE"
<!-- rtk-instructions v2 -->
# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule
**Always prefix commands with `rtk`**. Even in command chains with `&&`:
```bash
rtk git add . && rtk git commit -m "msg" && rtk git push
```
<!-- /rtk-instructions -->

# REPOSITORY AGENT DIRECTIVES - ORG_WEBSITE

## MANDATORY CORE DIRECTIVES
1. **Code & Doc Preservation**: NEVER remove any code block or documentation without detailed analysis and explicit technical justification.
2. **Bash**: Prefix all bash execution with `rtk` (e.g. `rtk git status`, `rtk docker ps`, `rtk bun test`).
3. **Zero Host Installation**: STRICTLY ZERO package installs on developer host machine (`apt-get`, `npm -g`, `pip`, `brew`). Use standalone repo environments ONLY (`bun`, `./.venv/bin/python3`, `./.venv/bin/mkdocs`, `portables/`) or Docker containers (`./run.sh docker ...` / `./run.sh toolchain ...`).
4. **Command Safety**: NEVER run heavy/time-consuming commands. Prompt user.
5. **Git Policy**: DO NOT commit automatically. Stage changes only.
6. **Work Logs**: Append one-liner to `logs/WORKLOGS.md` (tracked in git): `YYYY-MM-DD HH:mm | <brief>`.
7. **Communication**: Caveman ULTRA mode (max token compression, state facts once).
8. **Sync Guard**: Whenever modifying any instruction or rule file (`AGENTS.md`, `.agents/AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`, `.agents/rules/*.md`, `.agents/workforce/*.md`), run `./.agents/scripts/sync-agent-instructions.sh`.

## EXECUTION ENVIRONMENT BOUNDARIES
- **STRICTLY DOCKER**: Multi-service full dev stack (`./run.sh docker dev`), production sandbox simulation (`./run.sh docker sandbox`), polyglot verification toolchain (`./run.sh toolchain [all|lint|security|test]`).
- **PORTABLE PERMITTED**: Single-service TS/JS debugging (`bun` / `./run.sh portable dev`), local MkDocs serve (`./.venv/bin/mkdocs serve`), codebase metrics (`./scripts/code-matrix.sh`, `portables/bin/scc`), pre-commit validation (`./toolchain/run-precommit.sh`).
- See full documentation: [Standalone Software & Environments Guide](docs/guides/standalone-software-and-environments.md).

## DOMAIN RULE ROUTER (READ SPECIFIC FILE WHEN WORKING ON THAT DOMAIN)
Before writing or modifying code in a specific domain, agents MUST read the corresponding rule file:
- **Core System & Tooling**: `.agents/rules/core.md`
- **Architecture, Database, Logging**: `.agents/rules/architecture.md`
- **Frontend UI, Theme, Headers, Dropdowns & Containment**: `.agents/rules/frontend-ui.md`
- **Docker & Container Security**: `.agents/rules/docker-containers.md`
- **Testing Standards**: `.agents/rules/testing.md`

## AGENT WORKFORCE SPECIALIZATIONS
- **Investigator**: `.agents/workforce/INVESTIGATOR.md`
- **Builder**: `.agents/workforce/BUILDER.md`
- **Reviewer**: `.agents/workforce/REVIEWER.md`
EOF
echo "  [✓] Synced to CLAUDE.md"

# 3. Sync core directives to .github/copilot-instructions.md
mkdir -p "$REPO_ROOT/.github"
cat << 'EOF' > "$COPILOT_FILE"
# GitHub Copilot Instructions - org_website

## MANDATORY CORE DIRECTIVES & STRICT AGENT RULES
1. **Zero Host Installation**: STRICTLY PROHIBITED from running host-level installation commands (`apt-get install`, `npm install -g`, `pip install`, `brew install`). ALL runtimes, linters, and compilers MUST be invoked strictly via repo-bundled portables (`portables/`, `./.venv/`) or isolated Docker containers (`./run.sh docker ...` / `./run.sh toolchain ...`).
2. **Code & Doc Preservation**: NEVER remove any code block or documentation without detailed analysis and explicit technical justification.
3. **Bash Execution**: Always use `rtk` prefix (`rtk git ...`, `rtk docker ...`, `rtk bun test`).
4. **Command Safety**: Never run long build/docker commands directly without user authorization. Provide commands to user.
5. **Git Policy**: Do not auto commit changes. Stage changes only.
6. **Work Logs**: Append session brief to `logs/WORKLOGS.md` (tracked in git): `YYYY-MM-DD HH:mm | <brief>`.
7. **Communication**: Caveman ULTRA mode (terse, direct, zero fluff).
8. **Sync Guard**: Whenever modifying any instruction or rule file (`AGENTS.md`, `.agents/AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`, `.agents/rules/*.md`, `.agents/workforce/*.md`), run `./.agents/scripts/sync-agent-instructions.sh`.
9. **UI Standards**: Strictly responsive SPA. Elements/fields never breach parent cards/elements. Dropdowns strictly top layer (`z-index: 9999`/portal) within visible window. Popups/notifications modern styled.
10. **Refactoring/Deprecation**: ALWAYS preserve original legacy implementations in `legacy/` directory before refactoring or removing.

## EXECUTION ENVIRONMENT BOUNDARIES (DOCKER VS PORTABLE)
- **STRICTLY DOCKER**:
  - Full dev stack with microservices & DB: `./run.sh docker dev`
  - Production sandbox simulation: `./run.sh docker sandbox`
  - Verification & security toolchain: `./run.sh toolchain [all|lint|security|test]`
- **REPO-BUNDLED PORTABLE PERMITTED**:
  - Local single-service TS/JS execution: `bun <script>` or `./run.sh portable dev`
  - Documentation serving: `./.venv/bin/mkdocs serve`
  - Metrics & complexity analysis: `./scripts/code-matrix.sh`, `portables/bin/scc`, `portables/bin/lizard`, `portables/bin/tree`, `portables/bin/hyperfine`, `portables/bin/astryx`
  - Pre-commit checks: `./toolchain/run-precommit.sh`
- Reference guide: [Standalone Software & Environments Guide](docs/guides/standalone-software-and-environments.md).

## DOMAIN RULE ROUTER (READ SPECIFIC FILE WHEN WORKING ON THAT DOMAIN)
Before writing or modifying code in a specific domain, agents MUST read the corresponding rule file:
- **Core System & Tooling**: `.agents/rules/core.md`
- **Architecture, Database, Logging**: `.agents/rules/architecture.md`
- **Frontend UI, Theme, Headers, Dropdowns & Containment**: `.agents/rules/frontend-ui.md`
- **Docker & Container Security**: `.agents/rules/docker-containers.md`
- **Testing Standards**: `.agents/rules/testing.md`

## AGENT WORKFORCE SPECIALIZATIONS
- **Investigator**: `.agents/workforce/INVESTIGATOR.md`
- **Builder**: `.agents/workforce/BUILDER.md`
- **Reviewer**: `.agents/workforce/REVIEWER.md`
EOF
echo "  [✓] Synced to .github/copilot-instructions.md"

echo "All agent instruction files successfully synchronized."
