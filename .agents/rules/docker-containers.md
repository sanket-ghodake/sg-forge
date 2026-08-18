# Docker & Container Security Rules

1. **Docker Setup & Zero Host Installation**: All dev/build/test operations MUST run inside Docker containers (`docker compose`), `bun` (`portables/bun/bin/bun`), or Python virtualenv (`./.venv/`). STRICTLY ZERO host system package installs.
2. **Container Security Standards**: All Dockerfiles MUST use multi-stage builds (`development`, `builder`, `production`), implement explicit health check contracts (`HEALTHCHECK`), run production stages under non-root system users (`USER nextjs`/`appuser`), and enforce zero silent failure tolerance.
3. **Storage & Volume Protection**: Never use un-named anonymous volume mounts. Always use explicit named volumes (`sgforge-root-node-modules`, `sgforge-frontend-node-modules`, `sgforge-next-cache`) to prevent dangling disk storage exhaustion.
4. **RAM Resource Quotas & Log Limits**: All `docker-compose.yaml` services MUST enforce `deploy.resources.limits.memory` caps (e.g. 1024M app, 256M DB) and log rotation limits (`driver: json-file`, `max-size: 10m`, `max-file: 3`).
5. **Dev Build Speed & Cache Preservation**: Never wipe `.next` or build artifact caches inside container entrypoint scripts. Always use BuildKit package cache mounts (`--mount=type=cache,target=/root/.bun/install/cache`) and set `WATCHPACK_POLLING=false`.
6. **Docker vs Portable Execution Boundaries**:
   - **STRICTLY DOCKER**: Multi-service full dev stack (`./run.sh docker dev`), production sandbox simulation (`./run.sh docker sandbox`), polyglot linting/security toolchain (`./run.sh toolchain [all|lint|security|test]`).
   - **PORTABLE PERMITTED**: Single-service TS/JS debugging (`bun` / `./run.sh portable dev`), local MkDocs serve (`./.venv/bin/mkdocs serve`), codebase metrics (`./scripts/code-matrix.sh`, `portables/bin/scc`), pre-commit validation (`./toolchain/run-precommit.sh`).

