# AI AGENT DIRECTIVES - ORG_WEBSITE (2026 TECH STACK)

## MANDATORY CORE DIRECTIVES
1. **Code & Doc Preservation**: NEVER remove any code block or documentation without detailed analysis and explicit technical justification.
2. **Bash**: Prefix all bash execution with `rtk` (e.g. `rtk git status`, `rtk docker ps`, `rtk bun test`). Chains use `rtk`: `rtk git add . && rtk git commit`
3. **Environments & Zero Host Install**: ZERO package installs on host machine (`apt-get`, `npm -g`, `pip`, `brew`). Use standalone repo runtimes ONLY: Bun (`bun`, `portables/bun/bin/bun`), `./.venv/bin/python3`, `./.venv/bin/mkdocs`, `portables/`, or Docker (`./run.sh docker ...` / `./run.sh toolchain ...`). Never system runtimes.
4. **Tech Stack Baseline (2026)**: Node 26 LTS / Bun 1.x, Next.js 16, React 19, TypeScript 5, Drizzle ORM.
5. **Command Safety**: NEVER run heavy/time-consuming commands (docker builds, full test suites). Provide command to user.
6. **Git Policy**: DO NOT commit automatically (`git commit`). Only stage/commit when explicitly requested.
7. **Work Logs**: Append strictly ONE single line at the very end of `logs/WORKLOGS.md` (tracked in git): `YYYY-MM-DD HH:mm | <brief>` (or via `rtk run "./.agents/hooks/append-log.sh \"<brief>\""`). Never insert blank lines or multi-line text.
8. **Communication**: Caveman ULTRA mode (max token compression, state facts once, no filler).
9. **Sync Guard**: Whenever modifying any agent instruction or rule file (`AGENTS.md`, `.agents/AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`, `.agents/rules/*.md`, `.agents/workforce/*.md`), run `./.agents/scripts/sync-agent-instructions.sh` to keep all agent instructions in sync.
10. **UI Standards**: Strictly responsive SPA across all application ports (3001 Main Portal, 3002 Dev Dashboard, 3003 Developer Proxy Gateway). Elements/fields never breach parent cards/elements. Dropdowns strictly top layer (`z-index: 9999`/portal) within visible window. Popups/notifications modern styled. Use centralized theme variables (`--app-bg-root`, `--app-bg-surface`, `--app-bg-card`, `--app-border`, `--app-text-main`, `--app-text-muted`).


## DOMAIN RULE ROUTER (READ SPECIFIC FILE WHEN WORKING ON THAT DOMAIN)
Before writing or modifying code in a specific domain, agents MUST read the corresponding rule file:
- **Core System, Tooling & Workflows**: `.agents/rules/core.md`
- **Architecture, Monolith OS, Database, Logging & Code Standards**: `.agents/rules/architecture.md`
- **Frontend UI, Theme, Margins, Headers, Dropdowns & Containment**: `.agents/rules/frontend-ui.md`
- **Docker, Containers & Security**: `.agents/rules/docker-containers.md`
- **Testing Standards**: `.agents/rules/testing.md`

## AGENT WORKFORCE SPECIALIZATIONS
- **Investigator (Google-Grade)**: `.agents/workforce/INVESTIGATOR.md` (Code location & graph analysis)
- **Builder (Meta-Grade)**: `.agents/workforce/BUILDER.md` (Next.js 16 / React 19 UI & System architecture)
- **Reviewer (Apple/Microsoft-Grade)**: `.agents/workforce/REVIEWER.md` (Security, type-safety, accessibility audit)
