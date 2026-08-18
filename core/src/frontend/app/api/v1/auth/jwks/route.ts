import { getAllJwks } from "@backend/auth/keyManager";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const keys = getAllJwks();
    return NextResponse.json({
      keys,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
