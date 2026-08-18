# Database Layer (`src/database/`)

This directory manages database client connections, Drizzle schemas, migrations, and seeding scripts.

## Structure:
* **`schema.ts`:** Drizzle ORM schema defining table properties, indices, and defaults (`users`, `system_logs`, `structural_metadata`).
* **`connection.ts`:** Initializes the PostgreSQL client.
* **`initialize-local-db.ts`:** Executable script that creates tables (via raw SQL generated from schema structures) and seeds default records.

## Rules to Follow:
1. **Schema Updates:** Any new database table or column definition must be added to `schema.ts`. 
2. **Log Constraints:** Note that the `system_logs` table has a Postgres trigger rule capping entries to 100,000 logs to prevent unbounded storage leaks on local machines. Do not override this buffer trigger in production without setting up an archiver.
3. **Environment Injection:** Connection settings automatically fall back to localhost if `DATABASE_URL` is omitted. For staging/production, configure the correct database connection string inside the `.env` file.
