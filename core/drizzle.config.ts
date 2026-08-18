import type { Config } from "drizzle-kit";

export default {
  schema: "./src/database/schema.ts",
  out: "./src/database/migrations",
  driver: "pg",
  dbCredentials: {
    connectionString:
      process.env.DATABASE_URL || "postgres://lifeos:change_me_db_password@localhost:5432/org_db",
  },
} satisfies Config;
