import { jwtVerify, SignJWT } from "jose";

export interface UserSession {
  id: string;
  eid: string;
  email: string;
  name: string;
  role: string;
  isPasswordChanged: boolean;
}
function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  const isProduction = process.env.NODE_ENV === "production";
  const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

  if (!secret && isProduction && !isBuildPhase) {
    throw new Error("FATAL: JWT_SECRET environment variable is missing in production environment!");
  }

  return new TextEncoder().encode(
    secret || "fallback-super-secret-key-that-is-at-least-32-characters-long",
  );
}

export async function encryptSession(
  session: UserSession,
  expiresIn: string = "2h",
): Promise<string> {
  const secret = getJwtSecret();
  return await new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
}

export async function decryptSession(token: string): Promise<UserSession | null> {
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });
    return payload as unknown as UserSession;
  } catch (error: any) {
    return null;
  }
}

export async function decryptSessionWithExp(
  token: string,
): Promise<{ payload: UserSession; exp: number } | null> {
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });
    return {
      payload: payload as unknown as UserSession,
      exp: (payload as any).exp || 0,
    };
  } catch (error: any) {
    return null;
  }
}

export async function getSession(request: any): Promise<UserSession | null> {
  const tokenCookie = request.cookies.get("session_token");
  if (!tokenCookie) {
    return null;
  }

  try {
    return await decryptSession(tokenCookie.value);
  } catch (error: any) {
    if (process.env.NODE_ENV !== "test") {
      console.error("Session decryption failed:", error.message || error);
    }
    return null;
  }
}
