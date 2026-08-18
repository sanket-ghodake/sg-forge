import { db } from "@database/connection";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const result = await db.execute(sql`
      SELECT name, extended_attributes as "extendedAttributes"
      FROM structural_metadata
      WHERE type = 'company_name'
      LIMIT 1;
    `);
    const rows = result.rows || result;
    if (rows && rows.length > 0) {
      const row = rows[0] as any;
      return NextResponse.json({
        name: row.name,
        logo: row.extendedAttributes?.logo || "",
      });
    }
    return NextResponse.json({ name: "SG Forge", logo: "" });
  } catch (error: any) {
    return NextResponse.json({ name: "SG Forge", logo: "" });
  }
}
