/**
 * Forge SDK v1
 * Provides client-side postMessage utility wrappers and backend REST API helper clients.
 */

import { createRemoteJWKSet, jwtVerify } from "jose";

// ==========================================
// 1. Frontend SDK (iframe Client-side)
// ==========================================

export interface ThemeChangePayload {
  theme: string;
}

export type ThemeChangeListener = (payload: ThemeChangePayload) => void;

export interface AuthTokenPayload {
  code: string | null;
  token: string;
  user: {
    id: string;
    eid: string;
    name: string;
    email: string;
    role: string;
  };
}

export type AuthTokenListener = (payload: AuthTokenPayload) => void;

export class ForgeClient {
  private themeListener: ThemeChangeListener | null = null;
  private authListener: AuthTokenListener | null = null;
  private logoutListener: (() => void) | null = null;
  private parentOrigin: string;

  constructor() {
    let resolvedOrigin = "";
    if (typeof window !== "undefined") {
      if (document.referrer) {
        try {
          resolvedOrigin = new URL(document.referrer).origin;
        } catch {
          resolvedOrigin = window.location.origin;
        }
      } else {
        resolvedOrigin = window.location.origin;
      }
      if (
        (resolvedOrigin === "null" || !resolvedOrigin) &&
        (window as any).location.ancestorOrigins?.length > 0
      ) {
        resolvedOrigin = (window as any).location.ancestorOrigins[0];
      }
    }
    this.parentOrigin = resolvedOrigin;
    this.initMessageListener();
  }

  /**
   * Register a callback to listen for parent theme changes.
   */
  public onThemeChange(listener: ThemeChangeListener): () => void {
    this.themeListener = listener;
    return () => {
      this.themeListener = null;
    };
  }

  /**
   * Register a callback to listen for authorization token/code handshake.
   */
  public onAuthToken(listener: AuthTokenListener): () => void {
    this.authListener = listener;
    return () => {
      this.authListener = null;
    };
  }

  /**
   * Register a callback to listen for real-time user logout events.
   */
  public onLogout(listener: () => void): () => void {
    this.logoutListener = listener;
    return () => {
      this.logoutListener = null;
    };
  }

  /**
   * Request parent window to resize the iframe canvas or notify ready.
   */
  public notifyReady(): void {
    if (typeof window !== "undefined" && window.parent) {
      window.parent.postMessage({ type: "FORGE_APP_READY" }, this.parentOrigin || "*");
    }
  }

  /**
   * Request page navigation from the parent container.
   */
  public navigateParent(url: string): void {
    if (typeof window !== "undefined" && window.parent) {
      window.parent.postMessage({ type: "FORGE_NAVIGATE", url }, this.parentOrigin || "*");
    }
  }

  private initMessageListener(): void {
    if (typeof window === "undefined") return;

    window.addEventListener("message", (event) => {
      // Security: validate parent origin if parentOrigin is resolved and not opaque
      if (this.parentOrigin && this.parentOrigin !== "null" && event.origin !== this.parentOrigin) {
        return;
      }

      const { data } = event;
      if (!data) return;

      if (data.type === "THEME_CHANGE" && data.theme) {
        // Automatically sync HTML data-theme attribute
        document.documentElement.setAttribute("data-theme", data.theme);
        if (this.themeListener) {
          this.themeListener({ theme: data.theme });
        }
      }

      if (data.type === "FORGE_AUTH_TOKEN") {
        if (this.authListener) {
          this.authListener({
            code: data.code || null,
            token: data.token,
            user: data.user,
          });
        }
      }

      if (data.type === "FORGE_LOGOUT_EVENT") {
        if (this.logoutListener) {
          this.logoutListener();
        } else {
          // Default action: force reload to destroy state and trigger parent redirect
          window.location.reload();
        }
      }
    });
  }
}

// ==========================================
// 2. Backend SDK (REST API client wrapper)
// ==========================================

export interface ExchangeResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: {
    id: string;
    eid: string;
    name: string;
    email: string;
    role: string;
  };
  scopes: string[];
}

export interface UserProfileResponse {
  user: {
    id: string;
    eid: string;
    name: string;
    email: string;
    role: string;
    designation: string;
    verticalName: string;
    hierarchyLevel: number;
    manager?: {
      id: string;
      eid: string;
      name: string;
      email: string;
      designation: string;
    } | null;
  };
}

export interface PermissionsResponse {
  permissions: string[];
  scopes: string[];
}

export interface AuditLogResponse {
  success: boolean;
  logId: string;
}

export class ForgeBackendClient {
  private baseUrl: string;
  private clientId: string;
  private clientSecret: string;

  constructor(config: { baseUrl: string; clientId: string; clientSecret: string }) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ""); // strip trailing slash
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
  }

  /**
   * Exchanges the temporary authorization code/token for an access token.
   */
  public async exchangeCode(code: string): Promise<ExchangeResponse> {
    const response = await fetch(`${this.baseUrl}/api/v1/auth/exchange`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to exchange authorization code: ${response.status} - ${errorText}`);
    }

    const data: ExchangeResponse = await response.json();

    // Verify the JWT signature locally!
    try {
      const JWKS = createRemoteJWKSet(new URL(`${this.baseUrl}/api/v1/auth/jwks`));
      await jwtVerify(data.access_token, JWKS, {
        algorithms: ["RS256"],
      });
    } catch (err: any) {
      throw new Error(`JWT Signature verification failed: ${err.message}`);
    }

    return data;
  }

  /**
   * Retrieves user information using the access token.
   */
  public async getUserInfo(accessToken: string): Promise<UserProfileResponse> {
    const response = await fetch(`${this.baseUrl}/api/v1/user`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to retrieve user info: ${response.status} - ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Retrieves permissions and scopes using the access token.
   */
  public async getUserPermissions(accessToken: string): Promise<PermissionsResponse> {
    const response = await fetch(`${this.baseUrl}/api/v1/permissions`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to retrieve permissions: ${response.status} - ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Submits an audit log to the platform audit logs repository.
   */
  public async writeAuditLog(
    accessToken: string,
    action: string,
    severity: "INFO" | "WARN" | "ERROR" | "CRITICAL",
    payload: Record<string, any> = {},
  ): Promise<AuditLogResponse> {
    const response = await fetch(`${this.baseUrl}/api/v1/audit/log`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        action,
        severity,
        payload,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to write audit log: ${response.status} - ${errorText}`);
    }

    return await response.json();
  }
}

// Expose browser globals for direct script tag loading
if (typeof window !== "undefined") {
  (window as any).ForgeClient = ForgeClient;
  (window as any).ForgeBackendClient = ForgeBackendClient;
}
