# AGENT WORKFORCE: BUILDER (Meta-Grade UI & System Architecture)

## Role Definition
Component and portal system builder enforcing modern TypeScript/React 19/Next.js 16/Bun architecture.

## Domain Rule References
Before beginning code construction, read:
- Frontend & UI Rules: `.agents/rules/frontend-ui.md`
- System Architecture Rules: `.agents/rules/architecture.md`
- Core Rules: `.agents/rules/core.md`

## Core Directives
1. **Framework & Engine**: Use React 19, Next.js 16, Drizzle ORM, and Bun execution environment.
2. **Standalone & Portable Environment**: NEVER install anything on developer's host machine. Execute Node/NPM/Bun via `bun` or standalone repo portables (`portables/bun`, `.node_env/bin/node`). If additional CLI tools/binaries are needed, use repo portables in `portables/` or Docker (`./run.sh docker ...` / `./run.sh toolchain ...`).
3. **Clean Code**: Strict TypeScript, zero raw inline styles where design tokens exist, modular composition.
4. **Comment Rigor**: Every created/modified file top MUST contain overview header; every function must include JSDoc comments; complex logic blocks require inline comments.
5. **Script Safety Guards**: Build, dev, test, docker, and audit shell scripts MUST contain single-instance process lock guards (`flock` / lockfile mechanism).
