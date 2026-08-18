# Forge SDK Rules & Contract

This document defines the strict architectural boundaries and the API contracts for the shared SDK package (`@packages/sdk`).

---

## 🏗 Context Boundaries

### 1. Application Isolation & Sandboxing
All micro-applications inside `sandbox/apps/` are treated as decoupled, sandboxed extensions:
*   **UI Sandboxing**: Micro-apps run inside `<iframe>` components within the host Next.js interface.
*   **Memory Isolation**: Direct JavaScript window access is blocked. Sub-apps communicate exclusively using `window.postMessage` API contracts.
*   **No Cross-Imports**: Absolute or relative imports crossing workspace boundaries (e.g. from `sandbox/apps/` into `core/src/`) are disallowed.

### 2. Database Namespace Isolation
If an application manifest requests a database schema, the platform provisions a dedicated PostgreSQL schema name:
*   Sub-apps are restricted to their schema name context (e.g. `forge_expenses`).
*   Sub-apps are prohibited from running direct queries against public core schemas (`users`, `system_logs`, `forge_apps`).

### 3. UI Theme Synchronization
Applications can inherit the portal's active styling theme or run custom corporate branding:
*   **Inheritance**: Sub-apps should listen to theme change broadcast messages (`THEME_CHANGE`) and update their layout styling context.
*   **Custom Theme Overwriting**: Sub-apps requiring custom branding can ignore host theme broadcasts and define a static `data-theme` or hardcoded CSS variables directly in their markup.

---

## 🌐 1. Client-Side API (`ForgeClient`)

The client SDK runs inside the application iframe and coordinates communication with the parent window via `postMessage`.

### `onThemeChange()`
Subscribes to portal theme change events.
*   **Signature**:
    ```typescript
    onThemeChange(listener: (payload: { theme: string }) => void): () => void
    ```
*   **Protocol Payload**:
    When the portal theme switches, the host window posts:
    ```json
    { "type": "THEME_CHANGE", "theme": "dark" }
    ```
    The client automatically applies this by updating `<html data-theme="...">` inside the iframe.

### `notifyReady()`
Signals to the parent portal that the application has completed initialization and is ready to show.
*   **Signature**:
    ```typescript
    notifyReady(): void
    ```
*   **Protocol Payload**:
    ```json
    { "type": "FORGE_APP_READY" }
    ```

### `navigateParent(url)`
Requests the host portal to redirect the outer viewport to a new path.
*   **Signature**:
    ```typescript
    navigateParent(url: string): void
    ```
*   **Protocol Payload**:
    ```json
    { "type": "FORGE_NAVIGATE", "url": "/user/profile" }
    ```

---

## 💻 2. Backend API (`ForgeBackendClient`)

The backend client runs inside the application's runtime environment, authenticating using bearer tokens and client secrets.

### Initialization
```typescript
import { ForgeBackendClient } from '@packages/sdk';

const sdk = new ForgeBackendClient({
  baseUrl: "http://localhost:3001",
  clientId: process.env.CLIENT_ID || "app_id",
  clientSecret: process.env.CLIENT_SECRET || "app_secret"
});
```

### `exchangeCode(code)`
Exchanges a short-lived authorization code (sent as a query parameter when mounting the iframe) for a secure OAuth access token.
*   **Signature**:
    ```typescript
    exchangeCode(code: string): Promise<ExchangeResponse>
    ```
*   **Response Payload**:
    ```typescript
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

### `getUserInfo(accessToken)`
Retrieves full user identity profile information using the active access token.
*   **Signature**:
    ```typescript
    getUserInfo(accessToken: string): Promise<UserProfileResponse>
    ```

### `writeAuditLog(accessToken, action, severity, payload)`
Creates an audit log entry in the host platform logs system.
*   **Signature**:
    ```typescript
    writeAuditLog(
      accessToken: string,
      action: string,
      severity: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL',
      payload?: Record<string, any>
    ): Promise<AuditLogResponse>
    ```
