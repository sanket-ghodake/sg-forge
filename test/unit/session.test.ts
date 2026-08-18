import { describe, expect, test } from "bun:test";
import { decryptSessionWithExp, encryptSession, getSession } from "@backend/auth/sessionManager";

describe("Stateless Session Manager", () => {
  test("Returns null if session_token cookie is missing", async () => {
    const mockRequest = {
      cookies: {
        get: (name: string) => {
          if (name === "session_token") return null;
          return null;
        },
      },
    } as any;

    const session = await getSession(mockRequest);
    expect(session).toBeNull();
  });

  test("Returns null if session_token cookie is malformed", async () => {
    const mockRequest = {
      cookies: {
        get: (name: string) => {
          if (name === "session_token") return { value: "invalid-base64-string!!!" };
          return null;
        },
      },
    } as any;

    const session = await getSession(mockRequest);
    expect(session).toBeNull();
  });

  test("Returns decoded UserSession when session_token is valid", async () => {
    const expectedUser = {
      id: "abc-123",
      eid: "E0001",
      email: "test@acmecorp.com",
      name: "Test User",
      role: "user",
      isPasswordChanged: true,
    };
    const jwtValue = await encryptSession(expectedUser);

    const mockRequest = {
      cookies: {
        get: (name: string) => {
          if (name === "session_token") return { value: jwtValue };
          return null;
        },
      },
    } as any;

    const session = await getSession(mockRequest);
    expect(session).toBeDefined();
    expect(session).toMatchObject(expectedUser);
  });

  test("decryptSessionWithExp returns payload and valid exp timestamp", async () => {
    const expectedUser = {
      id: "xyz-789",
      eid: "E9999",
      email: "exp@sgforge.com",
      name: "Expiry User",
      role: "admin",
      isPasswordChanged: true,
    };
    const jwtValue = await encryptSession(expectedUser);

    const sessionData = await decryptSessionWithExp(jwtValue);
    expect(sessionData).toBeDefined();
    expect(sessionData?.payload).toMatchObject(expectedUser);
    expect(sessionData?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });
});
