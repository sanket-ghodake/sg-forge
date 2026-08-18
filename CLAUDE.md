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
