# PROJECT CONSTITUTION: ORG_WEBSITE

This repository strictly follows **Architecture-First Development**. Every AI assistant, developer, and automated agent MUST adhere to the non-negotiable rules defined in this constitution.

---

## 1. Core Architecture Principles

1. **Architecture Before Code**: Never write application feature code before requirements, domain models, API contracts, and folder structures are documented in `docs/`.
2. **Single Source of Truth**: Documentation in `docs/` and rules in `.agents/` define system behavior. Any code change that alters contracts, boundaries, or workflows MUST update documentation simultaneously.
3. **Standalone Environment & Command Proxy**:
   - All executions MUST use the local repo environment via `bun`, `./.venv/bin/python3`, `./.venv/bin/mkdocs`, or `portables/`.
   - All shell executions MUST be prefixed with `rtk` (Rust Token Killer).
4. **Framework Standard**: Frontend & server components MUST use Next.js 16, React 19, and Bun runtime engine.

---

## 2. Code Quality & Scope Constraints

1. **Strict Line Limits**:
   - Maximum file length: **300 lines**.
   - Maximum function length: **40 lines**.
2. **Zero Duplicated Logic**: Shared functionality MUST be extracted into isolated packages inside `packages/` or `core/`.
3. **Prefer Composition over Inheritance**: Design modules using small, single-purpose interfaces and capabilities.
4. **Dependency Injection**: Dependencies MUST be explicitly injected via constructors or factory methods. No global state singletons.
5. **No Unhandled Exceptions**: Backend database queries & API endpoints MUST return explicit error structures and clean status codes.

---

## 3. Boundary & Contract Discipline

1. **Module Independence**:
   - Database layer (Drizzle ORM) NEVER leaks internal entities to raw frontend presentation layers.
   - Core capabilities communicate through defined schemas and typed interfaces.
2. **Public Contract Stability**: Public APIs, SDK methods, and database schemas MUST be versioned.
3. **Frozen Folder Structure**: Never invent top-level directories. All structural additions MUST adhere to `docs/` conventions.

---

## 4. Verification & Testing Standards

1. **Mandatory Test Coverage**: Every exported package MUST maintain >80% test coverage.
2. **Isolated Unit Tests**: Unit tests MUST mock external networks, databases, and filesystem interactions. Run unit tests via `rtk bun test test/unit`.
3. **No TODOs Without Issue Tracking**: No `# TODO` or `// TODO` allowed in code without a corresponding tracking issue number.
4. **Automated Verification Pipeline**: Every task must pass:
   ```text
   Formatting -> Linting -> Type Checking -> Unit Tests -> Build
   ```

---

## 5. Security & Performance

1. **Secrets Isolation**: Secrets (API keys, tokens, credentials) MUST NEVER be committed or logged. Use environment variables and secret stores.
2. **Open-Source Directive**: All software components, libraries, CLI utilities, security audit tooling, and frameworks used MUST be 100% free and open-source (FOSS).
3. **Readability First**: Clear, idiomatic code takes precedence over clever code optimizations.
