# Project Context

## Vision
The project is a high-performance, standalone, plug-and-play organizational workspace engine (SG Forge Portal). Its vision is to replace legacy, static tabular directories with a fluid, infinite-canvas style workspace offering real-time zoomable visualization, seamless user onboarding, and a sandboxed ecosystem for custom corporate micro-apps.

## Business Goal
- Deliver a responsive semantic workspace (Org Canvas) with Macro, Meso, and Micro states for visual organization mapping.
- Standardize identity management via secure bulk ingestion and mandatory, guard-intercepted password resets.
- Provide a secure, isolated extension sandbox (`src/apps/`) allowing independent custom micro-apps to scale without compromising core stability or database layers.
- Maintain sub-100ms interaction latency while supporting scaling dimensions up to 100,000+ concurrent sessions.

## Architecture
- **Runtime:** Bun v1.2+ provides a high-performance alternative to Node.js, coordinating packages, tests, and runners.
- **Frontend Framework:** Next.js 15+ (App Router) using React 19 Server Components (RSC) to minimize client-side bundle sizes.
- **Backend & Middleware:** Next.js Edge Middleware for global route checking (`authGuard.ts`).
- **Database & ORM:** PostgreSQL database layered with Drizzle ORM for schema generation and real-time workbench reflection.
- **Session Layer & Security:** Stateless session tokens encoded as base64url inside secure HTTP-only cookies, verified via `jose` and `iron-session`. Security policies enforce strict role-based access gating, input sanitization, and origin-validated `postMessage` contracts.
- **Micro-App Sandbox:** Isolated micro-apps inside `src/apps/` rendered via local proxy `<iframe>` wrappers, using schema isolation (`CREATE SCHEMA`) and communicating strictly via `postMessage`.
- **Theming:** Tailwind CSS v4 custom theme system supporting 7 vibrant themes managed via `data-theme` on the root element.

## Important Decisions
- **Base64url Token Encoding:** Shifted all session tokens from standard base64 to base64url to strip `=` padding characters. This resolved an infinite login bounce loop caused by browsers/Next.js double-encoding `=` to `%253D` and throwing `InvalidCharacterError` on decode.
- **Zero-Install Local Development:** Housed all binaries (Bun, PostgreSQL) within the `.gitignore`'d `portables/` workspace directory, eliminating global dependency installations.
- **Privilege-Sanitized SQL Workbench:** Implemented client-role simulation filters to inspect and reject dangerous SQL mutations (`DROP`, `DELETE`, etc.) for read-only administrator accounts before backend execution.
- **Non-Passive Event Handlers:** Attached canvas wheel events manually using `{ passive: false }` via standard `useEffect` hooks, bypassing React 17's default passive listener behavior to prevent console warnings when blocking scroll propagation.
- **Origins-Validated PostMessage:** Replaced open wildcard (`*`) origins in `postMessage` calls with `window.location.origin` to avoid token/context leaks to malicious frames.
- **Optimized Log Management:** Replaced synchronous, performance-degrading PostgreSQL triggers (`prune_system_logs_buffer`) with asynchronous log operations to avoid write block bottlenecks.

## Coding Standards
- **Strict Sandbox Isolation:** Files under `src/apps/` must not import using relative directory structures crossing into `src/backend/` or `src/frontend/`.
- **Interface & Theme Synchronization:** Extension frames must handle parent theme broadcasts (`THEME_CHANGE`) and map background colors/borders using theme-aware CSS custom properties (`--bg-portal`, `--warning`, etc.) rather than static styling configurations.
- **Environment-Driven Configuration:** Raw networking variables, schema identifiers, and system connection strings must be resolved dynamically via `.env` files.
- **Granular Role Gating:** Restrict administrative API handlers and workbenches via strict role checks (`super_admin`, `admin`, `read_only_admin`).
- **Documentation Preservation:** Retain all inline code comments and helper docstrings when applying modifications.

## Current Sprint
- **Task 1: Cryptographically Sign Session Cookies:** Implemented JWT creation via the `jose` package and client-side cookie reading.
- **Task 2: Enforce Role Gating on Query API Route:** Restricted `/api/query` route execution to administrative roles.
- **Task 3: Prevent Path Traversal in Manifest Ingestion:** Configured strict regex validations (`/^[a-zA-Z0-9_-]+$/`) for sandbox application manifests.
- **Task 4: Secure postMessage Wildcard Origin:** Locked iframe interfaces to local origin routes.
- **Task 5: Remove Synchronous COUNT(*) Trigger:** Dropped lagging table-scan pruning triggers from database initialization scripts.
- **Task 6: Resolve Edge Middleware Unawaited Fetch Loop:** Refactored middleware logging to properly await calls to `/api/logs`.
- **Task 7: Multi-Theme & UI Command Center Redesign:** Built custom tabs (Users, Ingestion, Structure, Audit logs) and registered 7 visual themes.

## Known Problems
- **AST Isolated Nodes:** AST dependency analysis flags 255 isolated or weakly connected nodes within the graph, indicating potential undocumented abstractions or gaps in structural mapping.
- **Capacity Limits:** System log tables enforce a rolling cap of 100,000 logs.

## Next Milestones
- **Next.js Production Bundling & Optimizations:** Standardize bundles and compile-time configurations.
- **Extension Development:** Build and mount target sandboxed services (`apex-expenses`, `billing`, `employees`, `nexus-provisioning`) inside the sidebar configuration matrix.
- **Real-Time Logging Pipeline:** Upgrade log ingestion to use non-blocking message buffers and webhook sync hooks.
