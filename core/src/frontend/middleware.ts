import { middleware as authMiddleware } from "@backend/middleware/authGuard";
import type { NextFetchEvent, NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  return authMiddleware(request, event);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static assets)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
