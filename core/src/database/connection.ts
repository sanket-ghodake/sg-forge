import * as schema from "@database/schema";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, types } from "pg";

// Force node-postgres to parse TIMESTAMP WITHOUT TIME ZONE (OID 1114) as UTC Date objects.
// This prevents timezone-offset skew bugs when running on host systems in local timezones.
types.setTypeParser(1114, (stringValue) => {
  return new Date(stringValue + "Z");
});

const connectionString =
  process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/org_db";
console.log("Database connection String:", connectionString);

const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  keepAlive: true,
});

pool.on("error", (err) => {
  console.warn("[PostgreSQL Pool] Warning: Unexpected idle client error:", err.message);
});

export const db = drizzle(pool, { schema });

// Dedicated read-only connection pool
const readOnlyPool = new Pool({
  connectionString: process.env.DATABASE_READONLY_URL || connectionString,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  keepAlive: true,
});

readOnlyPool.on("error", (err) => {
  console.warn("[PostgreSQL ReadOnly Pool] Warning: Unexpected idle client error:", err.message);
});

// Enforce read-only session status for all clients in this pool
readOnlyPool.on("connect", (client) => {
  client.query("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY").catch((err) => {
    console.error("Failed to set read-only session characteristics:", err);
  });
});

export const roDb = drizzle(readOnlyPool, { schema });
