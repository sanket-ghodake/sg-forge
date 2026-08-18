# Backend Framework (`src/backend/`)

This directory houses the core business logic, stateless authentication session policies, and the database query validation pipeline.

## Structure:
* **`auth/sessionManager.ts`:** Handles session token encryption, storage, parsing, and extraction.
* **`middleware/authGuard.ts`:** Auth checkpoint verifying active user identity and intercepting attempts when `isPasswordChanged === false`.
* **`api/admin/queryEngine.ts`:** Executes administrative PostgreSQL queries, enforcing read-only keyword verification guards.

## Rules to Follow:
1. **Stateless Session Management:** Keep session payloads lightweight. Do not store bloated objects (e.g. system configurations) inside the session token, as cookies are sent with every HTTP request.
2. **Query Sandbox Safety:** The query parser inside `queryEngine.ts` matches queries against destructive SQL statements (`DROP`, `DELETE`, `TRUNCATE`, `ALTER`). Ensure any new database mutation command is registered in this list to block privilege escalations.
3. **No Frontend Dependencies:** Never import client-side frameworks or React libraries inside backend modules. Backend modules must be strictly environment-agnostic Node/Bun modules.
