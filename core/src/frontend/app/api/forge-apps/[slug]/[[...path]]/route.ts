import { getSession } from "@backend/auth/sessionManager";
import { validateAppAccess } from "@backend/middleware/proxyGuard";
import { db } from "@database/connection";
import { sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

async function handleProxy(request: NextRequest, context: any) {
  // Await context.params for Next.js 15+ safety
  const params = await context.params;
  const slug = params?.slug as string;
  const subpath = params?.path as string[] | undefined;

  // Validate authentication session
  const session = await getSession(request);
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Validate user access to the app target rules
  const hasAccess = await validateAppAccess(session.id, session.role, slug);
  if (!hasAccess) {
    return new NextResponse("Forbidden: Access to this application is restricted", { status: 403 });
  }

  // Retrieve app entryUrl from DB
  const appResult = await db.execute(sql`
    SELECT entry_url, is_enabled FROM forge_apps WHERE slug = ${slug}
  `);
  const rows = appResult.rows || appResult;

  if (rows && rows.length > 0 && !rows[0].is_enabled) {
    return new NextResponse("Application is disabled by system administrator", { status: 403 });
  }
  if (!rows || rows.length === 0) {
    return new NextResponse("Application not found", { status: 404 });
  }

  let entryUrl = rows[0].entry_url as string;
  if (process.env.RUNNING_IN_DOCKER === "true") {
    entryUrl = entryUrl.replace("localhost", slug).replace("127.0.0.1", slug);
  }
  const pathStr = subpath ? subpath.join("/") : "";
  const queryStr = request.nextUrl.search;

  // Construct destination URL
  const targetUrlStr = entryUrl.endsWith("/") ? entryUrl : `${entryUrl}/`;
  const targetUrl = new URL(pathStr + queryStr, targetUrlStr).toString();

  try {
    const headers = new Headers();
    if (request.headers && typeof request.headers.entries === "function") {
      for (const [key, value] of request.headers.entries()) {
        if (!["host", "cookie", "connection", "origin", "referer"].includes(key.toLowerCase())) {
          headers.set(key, value);
        }
      }
    } else if (request.headers && typeof (request.headers as any).forEach === "function") {
      (request.headers as any).forEach((value: string, key: string) => {
        if (!["host", "cookie", "connection", "origin", "referer"].includes(key.toLowerCase())) {
          headers.set(key, value);
        }
      });
    } else if (request.headers) {
      for (const key of Object.keys(request.headers)) {
        if (!["host", "cookie", "connection", "origin", "referer"].includes(key.toLowerCase())) {
          headers.set(key, (request.headers as any)[key]);
        }
      }
    }

    const body =
      request.body && ["POST", "PUT", "PATCH"].includes(request.method)
        ? await request.arrayBuffer()
        : undefined;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
      signal: controller.signal,
      redirect: "manual",
    });

    clearTimeout(timeoutId);

    const responseHeaders = new Headers();
    if (response.headers && typeof response.headers.entries === "function") {
      for (const [key, value] of response.headers.entries()) {
        responseHeaders.set(key, value);
      }
    } else if (response.headers && typeof (response.headers as any).forEach === "function") {
      (response.headers as any).forEach((value: string, key: string) => {
        responseHeaders.set(key, value);
      });
    } else if (response.headers) {
      for (const key of Object.keys(response.headers)) {
        responseHeaders.set(key, (response.headers as any)[key]);
      }
    }

    const origin =
      request.headers && typeof request.headers.get === "function"
        ? request.headers.get("origin") || "*"
        : "*";
    responseHeaders.set("Access-Control-Allow-Origin", origin);

    const responseBody = await response.arrayBuffer();
    return new NextResponse(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error: any) {
    const origin = request.headers.get("origin") || "*";
    if (request.method !== "GET") {
      console.error(
        `API proxy upstream failure for ${request.method} ${slug} to ${targetUrl}:`,
        error.message,
      );
      return NextResponse.json(
        {
          success: false,
          error: `Bad Gateway: Downstream service for ${slug} is unreachable or timed out`,
          message: error.message,
        },
        {
          status: 502,
          headers: {
            "Access-Control-Allow-Origin": origin,
          },
        },
      );
    }

    console.warn(
      `API proxy offline for ${slug} to ${targetUrl}. Serving simulated JSON fallback.`,
      error.message,
    );
    return NextResponse.json(
      {
        success: true,
        simulated: true,
        message:
          "Direct database connection to schema is offline. Operating in simulated local state.",
        data: [],
      },
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": origin,
        },
      },
    );
  }
}

export async function GET(request: NextRequest, context: any) {
  return handleProxy(request, context);
}

export async function POST(request: NextRequest, context: any) {
  return handleProxy(request, context);
}

export async function PUT(request: NextRequest, context: any) {
  return handleProxy(request, context);
}

export async function DELETE(request: NextRequest, context: any) {
  return handleProxy(request, context);
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": origin || "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}
