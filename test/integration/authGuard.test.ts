import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test";
import { encryptSession } from "@backend/auth/sessionManager";
import { middleware } from "@backend/middleware/authGuard";
import { NextResponse } from "next/server";

describe("Middleware Authentication Guard Pipeline", () => {
  let originalFetch: typeof fetch;

  beforeAll(() => {
    originalFetch = global.fetch;
    // Mock global fetch to prevent actual network calls in tests
    global.fetch = async (input: any, init: any) => {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    };
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  test("Redirects to /login if there is no session token", async () => {
    const mockRequest = {
      url: "http://localhost:3000/dashboard",
      nextUrl: {
        pathname: "/dashboard",
      },
      headers: {
        get: (name: string) => "127.0.0.1",
      },
      cookies: {
        get: (name: string) => null,
      },
    } as any;

    const response = await middleware(mockRequest);
    expect(response).toBeDefined();
    expect(response.status).toBe(307); // Temporary Redirect
    expect(response.headers.get("location")).toBe("http://localhost:3000/login");
  });

  test("Redirects to /force-reset if password is not changed and path is not /force-reset", async () => {
    const expectedUser = {
      id: "abc-123",
      eid: "E0001",
      email: "test@sgforge.com",
      name: "Test User",
      role: "user",
      isPasswordChanged: false, // Password reset required
    };
    const jwtValue = await encryptSession(expectedUser);

    const mockRequest = {
      url: "http://localhost:3000/dashboard",
      nextUrl: {
        pathname: "/dashboard",
      },
      headers: {
        get: (name: string) => "127.0.0.1",
      },
      cookies: {
        get: (name: string) => {
          if (name === "session_token") return { value: jwtValue };
          return null;
        },
      },
    } as any;

    const fetchSpy = spyOn(global, "fetch");

    try {
      const response = await middleware(mockRequest);
      expect(response).toBeDefined();
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("http://localhost:3000/force-reset");
      expect(fetchSpy).toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  test("Allows request to proceed if password is changed", async () => {
    const expectedUser = {
      id: "abc-123",
      eid: "E0001",
      email: "test@sgforge.com",
      name: "Test User",
      role: "user",
      isPasswordChanged: true, // Password already changed
    };
    const jwtValue = await encryptSession(expectedUser);

    const mockRequest = {
      url: "http://localhost:3000/dashboard",
      nextUrl: {
        pathname: "/dashboard",
      },
      headers: {
        get: (name: string) => "127.0.0.1",
      },
      cookies: {
        get: (name: string) => {
          if (name === "session_token") return { value: jwtValue };
          return null;
        },
      },
    } as any;

    const response = await middleware(mockRequest);
    expect(response).toBeDefined();
    // In Next.js middleware, a successful pass-through response will return a status 200 or an internal Next rewrite
    expect(response.status).toBe(200);
  });

  test("Allows public access to /developer route without a session when request has proxy header", async () => {
    const mockRequest = {
      url: "http://localhost:3000/developer",
      nextUrl: {
        pathname: "/developer",
      },
      headers: {
        get: (name: string) => {
          if (name === "x-from-developer-proxy") return "true";
          return "127.0.0.1";
        },
      },
      cookies: {
        get: (name: string) => null,
      },
    } as any;

    const response = await middleware(mockRequest);
    expect(response).toBeDefined();
    expect(response.status).toBe(200);
  });

  test("Redirects direct /developer access to port 3003", async () => {
    const mockRequest = {
      url: "http://localhost:3001/developer",
      nextUrl: {
        pathname: "/developer",
      },
      headers: {
        get: (name: string) => null,
      },
      cookies: {
        get: (name: string) => null,
      },
    } as any;

    const response = await middleware(mockRequest);
    expect(response).toBeDefined();
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3003/");
  });

  test("Allows public access to /api/apps without a session", async () => {
    const mockRequest = {
      url: "http://localhost:3000/api/apps",
      nextUrl: {
        pathname: "/api/apps",
      },
      headers: {
        get: (name: string) => "127.0.0.1",
      },
      cookies: {
        get: (name: string) => null,
      },
    } as any;

    const response = await middleware(mockRequest);
    expect(response).toBeDefined();
    expect(response.status).toBe(200);
  });

  test("Allows public access to GET /api/admin/metadata without a session", async () => {
    const mockRequest = {
      url: "http://localhost:3000/api/admin/metadata",
      nextUrl: {
        pathname: "/api/admin/metadata",
      },
      method: "GET",
      headers: {
        get: (name: string) => "127.0.0.1",
      },
      cookies: {
        get: (name: string) => null,
      },
    } as any;

    const response = await middleware(mockRequest);
    expect(response).toBeDefined();
    expect(response.status).toBe(200);
  });

  test("Sliding Session: Does not renew cookie if token is fresh (e.g. 2h remaining)", async () => {
    const freshUser = {
      id: "fresh-123",
      eid: "E8888",
      email: "fresh@sgforge.com",
      name: "Fresh User",
      role: "user",
      isPasswordChanged: true,
    };
    const freshJwt = await encryptSession(freshUser, "2h");

    const mockRequest = {
      url: "http://localhost:3000/dashboard",
      nextUrl: {
        pathname: "/dashboard",
      },
      headers: {
        get: (name: string) => "127.0.0.1",
      },
      cookies: {
        get: (name: string) => {
          if (name === "session_token") return { value: freshJwt };
          return null;
        },
      },
    } as any;

    const response = await middleware(mockRequest);
    expect(response).toBeDefined();
    expect(response.status).toBe(200);

    // Response should NOT contain a Set-Cookie header or cookie instructions for session_token
    const setCookie = response.headers.get("Set-Cookie");
    expect(setCookie).toBeNull();
  });

  test("Sliding Session: Renews cookie if token is near expiration (e.g. 10m remaining)", async () => {
    const expiringUser = {
      id: "expiring-123",
      eid: "E7777",
      email: "expiring@sgforge.com",
      name: "Expiring User",
      role: "user",
      isPasswordChanged: true,
    };
    // Sign a token expiring in 10 minutes (which is < 1 hour / 50% remaining time)
    const expiringJwt = await encryptSession(expiringUser, "10m");

    const mockRequest = {
      url: "http://localhost:3000/dashboard",
      nextUrl: {
        pathname: "/dashboard",
      },
      headers: {
        get: (name: string) => "127.0.0.1",
      },
      cookies: {
        get: (name: string) => {
          if (name === "session_token") return { value: expiringJwt };
          return null;
        },
      },
    } as any;

    const response = await middleware(mockRequest);
    expect(response).toBeDefined();
    expect(response.status).toBe(200);

    // Response MUST contain a Set-Cookie header updating session_token
    const cookiesList = response.cookies.getAll();
    const renewedCookie = cookiesList.find((c) => c.name === "session_token");
    expect(renewedCookie).toBeDefined();
    expect(renewedCookie?.value).not.toBe(expiringJwt);
  });
});
