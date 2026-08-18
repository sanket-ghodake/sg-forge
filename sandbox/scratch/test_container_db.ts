import { sql } from "drizzle-orm";
import { db } from "../../core/src/database/connection";

async function test() {
  try {
    const result = await db.execute(sql`SELECT current_database(), current_user`);
    console.log("DB/User:", result.rows);
    const tables = await db.execute(sql`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
    `);
    console.log(
      "Tables:",
      tables.rows.map((t: any) => t.table_name),
    );
    const usersCount = await db.execute(sql`SELECT count(*) FROM users`);
    console.log("Users count:", usersCount.rows);
  } catch (err) {
    console.error("Error:", err);
  }
}
test();
