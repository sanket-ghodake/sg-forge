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
