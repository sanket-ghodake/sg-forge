# Resolution of Windows Environment Technical Issues

This document summarizes the structural fixes applied to address the four technical issues reported in the Windows environment. All changes have been verified against the build and integration test suites.

---

### 1. "Entrypoint not found" Error
* **Cause:** Windows-style CRLF (`\r\n`) line endings in shell scripts and Docker entrypoint scripts break execution inside Linux containers.
* **Fix Applied:** Created a `.gitattributes` file at the root of the workspace forcing `lf` line endings on all `*.sh`, `*.bash`, `entrypoint.sh`, and `Dockerfile*` files. This ensures that even when the repository is cloned on Windows, git checks out these files with Linux-compatible line endings.

---

### 2. Automated Manifest Scanner Issue (Visibility)
* **Cause:** App slugs were handled case-sensitively. A case mismatch between the registration payload on disk and database/entitlement lookups resulted in matching failures (e.g. `example-dashboard` vs. `EXAMPLE-DASHBOARD`), preventing sandbox apps from appearing in the user sidebar.
* **Fix Applied:**
  * Modified `validateManifest` in `core/src/backend/utils/manifestParser.ts` to automatically normalize manifest slugs to lowercase prior to validation and database insertion.
  * Updated `getMatchedAppsForUser` in `core/src/backend/services/appRegistry.ts` to execute a case-insensitive slug and ID comparison when intersecting database application records with discovered folders on disk.

---

### 3. App Accessibility / Networking Error
* **Cause:** Microservice servers bound to the local loopback interface (`127.0.0.1` or implicit local defaults) inside their isolated containers, making them unreachable from outside the container (e.g., from the host browser or developer gateway proxy).
* **Fix Applied:** Configured servers to bind explicitly to `0.0.0.0` (all interfaces) to expose the service to container bridges:
  * Added `hostname: '0.0.0.0'` in `sandbox/apps/reference-expenses/server.ts`.
  * Updated `socketserver.TCPServer` to bind to `"0.0.0.0"` in `sandbox/apps/reference-python/server.py`.
  * Added `hostname: '0.0.0.0'` to the dev-dashboard Bun server options in `core/src/backend/dev-dashboard/server.ts`.
  * Added `hostname: "0.0.0.0"` to the gateway proxy Bun server options in `scripts/developer-proxy.ts`.

---

### 4. Turbopack Parsing Failure (JSX Syntax Error)
* **Cause:** Raw `->` characters placed inside paragraph `<p>` tags within JSX syntax were interpreted by Turbopack as premature closing tags or syntax tokens, causing compilation failures.
* **Status:** Verified that all raw arrow occurrences in the JSX tree have been removed in the latest commit. The frontend now compiles successfully under Next.js 16/Turbopack, and the entire integration test suite passes (77 pass, 0 fail).

---

### Verification
* Ran `bun run --cwd core/src/frontend build` — **Compiled successfully in 5.3s**.
* Ran `bun test` — **77 pass, 0 fail**.
* Executed `graphify update .` — **Knowledge graph rebuilt and synchronized**.
