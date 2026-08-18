import { describe, expect, mock, test } from "bun:test";
import { jwtVerify, SignJWT } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-super-secret-key-that-is-at-least-32-characters-long",
);

async function decryptSession(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      algorithms: ["HS256"],
    });
    return payload;
  } catch (error: any) {
    return null;
  }
}

// Mock @backend/auth/sessionManager
mock.module("@backend/auth/sessionManager", () => {
  return {
    getSession: async (request: any) => {
      const url = request?.url || "";
      const tokenCookie = request?.cookies?.get?.("session_token");

      if (tokenCookie) {
        const val = typeof tokenCookie === "string" ? tokenCookie : tokenCookie.value;
        if (val) {
          const decrypted = await decryptSession(val);
          if (decrypted) return decrypted;
        }
        return null;
      }

      // Only mock when targeting the elevate api route
      if (url.includes("/api/auth/elevate") || url.includes("/elevate")) {
        return {
          id: "d3b07384-d113-4ec5-a5ae-be86064be485", // Valid UUID shape for mock admin
          role: "admin",
          email: "admin@acmecorp.com",
          name: "Arthur Pendragon",
          isPasswordChanged: true,
        };
      }

      return null;
    },
    encryptSession: async (session: any, expiresIn: string = "2h") => {
      return await new SignJWT({ ...session })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(expiresIn)
        .sign(JWT_SECRET);
    },
    decryptSessionWithExp: async (token: string) => {
      const decrypted = await decryptSession(token);
      if (!decrypted) return null;
      return {
        payload: decrypted as any,
        exp: (decrypted as any).exp || 0,
      };
    },
  };
});

import { GET, POST } from "@frontend/app/api/auth/elevate/route";

describe("Sudo Elevation API Route Handler", () => {
  test("GET returns not elevated status by default", async () => {
    const req = new Request("http://localhost/api/auth/elevate");
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.isElevated).toBe(false);
  });

  test("POST with invalid credentials rejects", async () => {
    const req = new Request("http://localhost/api/auth/elevate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "999999" }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  test("POST with valid code (123456) elevates", async () => {
    const req = new Request("http://localhost/api/auth/elevate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "123456" }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.isElevated).toBe(true);

    // Verify response headers contain Set-Cookie header for session_token
    const setCookie = res.headers.get("Set-Cookie");
    expect(setCookie).toContain("session_token");
  });
});
