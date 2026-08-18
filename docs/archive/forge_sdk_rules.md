# Forge SDK Rules & Architectural Boundaries

This document defines the strict boundaries, validation rules, and security policies governing application isolation and ecosystem scaling within the Forge platform.

---

## Context Boundary

### 1. Application Isolation & Sandboxing
All applications residing within `src/apps/` are treated as sandboxed, third-party extensions. They must not have relative imports (`../`) crossing into the host system (`src/backend/` or `src/frontend/`).
* **UI Sandboxing**: Applications are rendered inside isolated `<iframe>` environments in the host layout. 
* **State Isolation**: Sub-apps communicate with the host via standard `window.postMessage` API contracts, preventing direct memory access and cross-contamination.
* **TSConfig Bleed Guards**: The `tsconfig.json` files within `src/apps/` enforce strict compilation boundaries to block compile-time reference leaks.

### 2. Database Namespace Isolation
Each application requiring storage runs in its own isolated database schema namespace (`CREATE SCHEMA`).
* Applications are prohibited from executing raw SQL queries or Drizzle transactions against the `public` schema tables (`users`, `system_logs`, `forge_apps`).
* Shared state is managed strictly by the host backend and exposed through verified api contracts.

### 3. UI Theme Inheritance & Overwriting
Sub-apps must follow standard contracts to synchronize theme state with the host platform or custom-brand themselves.
* **Theme Inheritance**: Sub-apps rendered inside an `<iframe>` must listen for parent message broadcasts (`postMessage`) containing `{ type: 'THEME_CHANGE', theme: string }` and update the root `data-theme` attribute on `document.documentElement` accordingly.
* **Theme-Aware Tokens**: Instead of hardcoding color shades (e.g., `text-amber-400` or `bg-yellow-500/10`), sub-apps should use theme-dependent CSS variables (e.g. `--warning`, `--success`, `--danger`, `--accent`) to ensure high contrast and readability across light, dark, and solarized themes.
* **Local Theme Overwriting**: Sub-apps that require custom corporate branding or independent visual states can explicitly ignore the `THEME_CHANGE` event listener and configure a static `data-theme` or hardcoded CSS variables directly in their local markup.

---

## Immutable Rules

### 1. App Manifest Validation & Mount Rules
Every extension must supply a valid `app.json` manifest at its root folder. The App Manifest Parser enforces validation checks before mounting:
* **Unique Slug**: Each manifest must have a non-empty string `slug` property.
* **Routing Mode**: A valid `routingMode` (e.g. `iframe`) must be specified.
* **Fallback & Alerting**: Manifests lacking these parameters will fail validation, write a `WARN` event to `system_logs`, and be blocked from mounting to the sidebar navigation framework.

### 2. Password Reset Guard Redirection Policy
An active user session with `isPasswordChanged === false` is systematically locked out of all core pages and API endpoints.
* **Strict Redirects**: Any attempt to access system sub-routes will force redirect page requests to `/force-reset` and return `403 Forbidden` for REST API endpoints.
* **Exceptions**: Only the authentication/reset flows (`/force-reset`, `/api/auth/reset-password`, `/api/logs`) are accessible during this state.

### 3. Environment-Agnostic Variable Matrix
No hardcoded network ports, hostnames, or database connection strings are permitted inside application code.
* All configuration coordinates must reside in root `.env` environment variables and be injected at runtime.

---

## Public Interface

### 1. The Manifest Parser Service
* **`validateManifest(manifest, folderName)`**: Validates manifest schema compliance. Returns a validation result with a list of validation errors.
* **`parseAndRegisterManifests()`**: Scans `/src/apps`, validates files, creates database schemas for isolated apps, registers compliant apps into `forge_apps`, cleans up stale apps, and logs validation failures.

### 2. Global Security Middleware
* **`middleware(request)`**: Inspects all requests, checking session status and enforcing the password reset guard redirections.

---

> [!IMPORTANT]
> Adhering to these structural boundaries prevents runtime dependencies between the core platform and extension applications, ensuring the ecosystem scales cleanly without regression risks.
