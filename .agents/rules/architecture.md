# System Architecture, Database & Code Standards Rules

1. **Graphify**: Use `graphify` skill for codebase analysis & graph queries. Update command: `rtk graphify update .`. Query command: `rtk graphify query "<question>"`. Check `graphify-out/`.
2. **Comment Standards**: Every file MUST contain top-of-file overview header comment. Every function/method MUST have docstrings/comments describing inputs/outputs/behavior. Complex code blocks MUST have inline explanatory comments.
3. **Build Script Guards**: All build, dev, test, docker, and security audit scripts MUST implement single-instance lock guards (via `flock` or lockfile mechanism) to prevent concurrent execution collisions. Passive operations (`clean`, `logs`, `status`, `help`) are lock-exempt.
4. **Database Directive**: Use Drizzle ORM (`drizzle-orm`) and PostgreSQL / Redis configuration explicitly across all service modules. Always migration-lock database schema changes.
5. **Centralized Logging & Error Handling Directive**: Structured logging MUST be used across all server components and API routes. Raw `console.log` or generic unclassified errors are strictly forbidden in production paths.
6. **Module Boundaries**: Never violate module boundaries. Never create circular imports across workspace packages or TypeScript modules. Always inject dependencies via constructors or factory methods. Never use global singletons.
