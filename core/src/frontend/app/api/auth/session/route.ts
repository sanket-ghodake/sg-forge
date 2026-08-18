import { getSession } from "@backend/auth/sessionManager";
import { db } from "@database/connection";
import { users } from "@database/schema";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ session: null }, { status: 401 });
    }

    // Verify user still exists in the database to prevent stale session anomalies
    const [userExists] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, session.id))
      .limit(1);

    if (!userExists) {
      const response = NextResponse.json({ session: null }, { status: 401 });
      response.cookies.set("session_token", "", {
        path: "/",
        maxAge: 0,
        httpOnly: true,
        secure: true,
        sameSite: "lax",
      });
      return response;
    }

    return NextResponse.json({ session });
  } catch (error: any) {
    console.error("Session retrieval error:", error);
    return NextResponse.json({ session: null }, { status: 401 });
  }
}
