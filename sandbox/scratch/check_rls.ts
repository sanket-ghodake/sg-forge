import { sql } from "drizzle-orm";
import { db } from "../../core/src/database/connection";

async function test() {
  try {
    const rlsInfo = await db.execute(sql`
      SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'forge_apps'
    `);
    console.log("RLS Info:", rlsInfo.rows);

    const policies = await db.execute(sql`
      SELECT * FROM pg_policies WHERE tablename = 'forge_apps'
    `);
    console.log("Policies:", policies.rows);
  } catch (err) {
    console.error("Error:", err);
  }
}
test();
