import { sql } from "drizzle-orm";
import { db } from "../../core/src/database/connection";

async function test() {
  try {
    console.log("Inserting test row...");
    const result = await db.execute(sql`
      INSERT INTO forge_apps (slug, name, entry_url, is_isolated_lifecycle, client_id, client_secret, redirect_uri, scopes, target_rules)
      VALUES ('test-slug', 'Test App', 'http://localhost', false, 'client_test', 'secret_test', 'http://localhost', '[]'::jsonb, '{}'::jsonb)
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name
      RETURNING id
    `);
    console.log("Result type:", typeof result);
    console.log("Result properties:", Object.keys(result));
    console.log("Result rows:", (result as any).rows);
    console.log("Result directly:", result);
  } catch (err) {
    console.error("Error occurred:", err);
  }
}

test();
