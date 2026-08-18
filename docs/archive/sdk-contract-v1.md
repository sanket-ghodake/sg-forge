# SG Forge SDK v1 Contract Specification

This document defines the official, frozen SDK v1 interface contracts for developers building applications hosted on the SG Forge corporate application portal.

---

## 1. Client-Side API (`ForgeClient`)
The client-side library is loaded within the isolated application iframe. It communicates with the host portal parent window via standard asynchronous browser `postMessage` interfaces.

### `forge.theme()`
Subscribes to portal-wide color themes (default, dark, premium-obsidian) and automatically updates the iframe root context.

- **Signature:**
  ```ts
  onThemeChange(listener: (payload: { theme: string }) => void): () => void
  ```
- **Returns:** An unsubscribe release function.
- **Protocol Payload:**
  - On theme changes, the parent window sends:
    ```json
    { "type": "THEME_CHANGE", "theme": "dark" }
    ```
  - The client automatically updates `<html data-theme="...">` inside the iframe.

### `forge.notifyReady()`
Signals to the parent window that the application has completed initialization and is ready for display (triggers parent loading spinner removal).

- **Signature:**
  ```ts
  notifyReady(): void
  ```
- **Protocol Payload:**
  Sends the message:
  ```json
  { "type": "FORGE_APP_READY" }
  ```
  to the parent window.

### `forge.navigateParent(url)`
Requests the host parent window to navigate to a different route.

- **Signature:**
  ```ts
  navigateParent(url: string): void
  ```
- **Protocol Payload:**
  Sends the message:
  ```json
  { "type": "FORGE_NAVIGATE", "url": "/admin/dashboard" }
  ```
  to the parent window.

---

## 2. Backend API Client (`ForgeBackendClient`)
The backend SDK executes inside the application's isolated runtime environment. It interacts with the SG Forge Portal APIs using bearer tokens.

### Configuration
```ts
const client = new ForgeBackendClient({
  baseUrl: "http://localhost:3001",
  clientId: "YOUR_CLIENT_ID",
  clientSecret: "YOUR_CLIENT_SECRET"
});
```

### `forge.exchangeCode(code)`
Exchanges a temporary single-use authorization code (delivered as `?code=` query param on initial iframe load) for a secure OAuth access token.

- **Signature:**
  ```ts
  exchangeCode(code: string): Promise<ExchangeResponse>
  ```
- **Return Type (`ExchangeResponse`):**
  ```ts
  interface ExchangeResponse {
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
  ```

### `forge.user(accessToken)`
Retrieves full user identity metadata profile from the host platform using the application access token.

- **Signature:**
  ```ts
  getUserInfo(accessToken: string): Promise<UserProfileResponse>
  ```
- **Return Type (`UserProfileResponse`):**
  ```ts
  interface UserProfileResponse {
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
  ```

### `forge.permissions(accessToken)`
Retrieves full permission scopes assigned to the active token session.

- **Signature:**
  ```ts
  getUserPermissions(accessToken: string): Promise<PermissionsResponse>
  ```
- **Return Type (`PermissionsResponse`):**
  ```ts
  interface PermissionsResponse {
    permissions: string[];
    scopes: string[];
  }
  ```

### `forge.audit(accessToken, action, severity, payload)`
Triggers a portal-level audit log entry to record activities or security policy violations.

- **Signature:**
  ```ts
  writeAuditLog(
    accessToken: string,
    action: string,
    severity: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL',
    payload?: Record<string, any>
  ): Promise<AuditLogResponse>
  ```
- **Return Type (`AuditLogResponse`):**
  ```ts
  interface AuditLogResponse {
    success: boolean;
    logId: string;
  }
  ```
