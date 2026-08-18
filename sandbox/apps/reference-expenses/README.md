# Reference Expenses Tracker

## 1. Context Profile
* **Domain:** Enterprise Expense Submission, Monitoring, and Validation.
* **Role:** Serves as a reference micro-app demonstrating secure iframe integration, OAuth2 code exchanges, token-scoped database/API queries, and secure audit logging.

## 2. Network Target Mappings
* **Active Port:** `8085`
* **Environment Keys Required:**
  * `PORT`: Port on which the Bun server listens (defaults to `8085`).
  * `DATABASE_URL`: Connection string to the PostgreSQL database (defaults to `postgres://lifeos:change_me_db_password@localhost:5432/org_db`).
  * `PORTAL_INTERNAL_URL`: Internal URL for reaching the Next.js host portal APIs (e.g., `http://app:3001` or `http://localhost:3001`).

## 3. Storage Tier Isolation
* **Schema Namespace:** `forge_reference_expenses`
* **Isolated Table Structure:**
  * `forge_reference_expenses.expenses`
    * `id`: `UUID` (Primary Key, defaults to `gen_random_uuid()`)
    * `title`: `VARCHAR(255)` (Not Null)
    * `amount`: `DECIMAL(10, 2)` (Not Null)
    * `category`: `VARCHAR(100)` (Not Null)
    * `user_id`: `UUID` (Not Null)
    * `user_name`: `VARCHAR(255)` (Not Null)
    * `status`: `VARCHAR(50)` (Defaults to `'pending'`)
    * `created_at`: `TIMESTAMP` (Defaults to `NOW()`)

## 4. Independent Execution Command
To build and run this sandbox application independently using Docker:
```bash
docker compose up -d --build
```
Or to run locally via Bun:
```bash
bun run server.ts
```
