# Project Vision & Decisions

## Project Vision

The vision of the SG Forge platform is to transform corporate directory listings from static tables into a fluid, infinite-canvas style semantic workspace. This environment provides real-time zoomable visual mapping, unified user onboarding, and a secure ecosystem for custom micro-applications.

---

## Key Architectural Decisions

### 1. Base64url Session Token Encoding
To eliminate infinite login redirection loops, the platform encodes session JWTs using the `base64url` standard (per RFC 4648). This strips trailing `=` padding characters that previously caused browsers/Next.js to double-encode values to `%253D`, triggering `InvalidCharacterError` exceptions during decoding.

### 2. Zero-Install Portability
To ensure immediate onboarding for developers, the repository provides standalone binaries (e.g., `bun` runtime) directly inside the `.gitignore`'d `portables/` directory. The entire platform can be run locally using the `run.sh` script without requiring global environment configuration or administrator access.

### 3. Privilege-Sanitized SQL Workbench
The database workspace implements runtime parsing and simulation filters. It reviews and rejects dangerous operations (such as `DROP`, `DELETE`, or structural mutations) for users authenticated with read-only roles (e.g., `read_only_admin`) before queries reach the database connection pool.

### 4. Origins-Validated postMessage Contracts
Communication between the core Next.js parent canvas and child iframe micro-applications is secured by validating standard message events. The wildcard origin `*` is explicitly forbidden; instead, frames are locked to `window.location.origin` to prevent data leaks.

### 5. Asynchronous Log Buffer Management
To prevent database write block bottlenecks under heavy traffic, system logging operates asynchronously. Synchronous `COUNT(*)` triggers that previously blocked thread execution have been removed from the hot path.

---

## Monorepo Coding Standards

*   **Strict Sandbox Isolation**: Files under `sandbox/apps/` must operate as decoupled services. Direct relative imports crossing workspace boundaries (e.g., reaching into `core/src/`) are strictly blocked.
*   **Dynamic Theme Broadcasting**: Micro-applications must listen for parent theme broadcasts (`THEME_CHANGE` event via `postMessage`) and dynamically map CSS properties (`--bg-portal`, `--warning`, etc.) to match the portal's active palette.
*   **Environment-Driven Configs**: All connection strings, ports, and external network variables must be defined inside target files in the `config/envs/` directory.
*   **Role Gating**: Critical API endpoints and mutations must enforce strict checks against user roles (`super_admin`, `admin`, `read_only_admin`).
