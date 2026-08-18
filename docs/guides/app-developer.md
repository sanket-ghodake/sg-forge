# App Developer Guide

Welcome! This guide outlines how to build, configure, and register applications (Forge Apps) that integrate with the SG Forge Portal.

---

## 📂 Application Directory Structure

Every Forge App runs as an independent server process and resides in the `sandbox/apps/` folder:

```text
sandbox/apps/my-app/
├── app.json         # REQUIRED: Manifest configuration file
├── server.ts        # App server (Node/Bun, Python, Go, etc.)
└── index.html       # Client-side interface
```

---

## 📄 Manifest Configuration (`app.json`)

Every application must include an `app.json` manifest file at its directory root. The portal scans and registers these configurations during startup.

### Manifest Schema Reference
```json
{
  "id": "my-app-unique-id",
  "slug": "my-app",
  "name": "My Extension App",
  "description": "Performs custom business actions inside SG Forge",
  "icon": "Layers",
  "roles": ["super_admin", "admin", "user"],
  "entryPoint": "http://localhost:8088",
  "routingMode": "iframe",
  "database": {
    "requiresIsolatedSchema": true,
    "schemaName": "forge_my_app"
  },
  "targetRules": {
    "verticals": ["Engineering", "Product Management"],
    "designations": ["L5 Senior Software Engineer"],
    "minJobLevel": 2
  }
}
```

### Manifest Fields Description
*   **`id` (String)**: Globally unique application identifier.
*   **`slug` (String)**: URL-friendly string used in routing (`/apps/my-app`).
*   **`name` / `description` (String)**: User-facing metadata shown in the launchpad directory.
*   **`icon` (String)**: Name of a Lucide Icon (e.g. `Cpu`, `Users`, `CreditCard`, `Layers`).
*   **`roles` (Array)**: Base RBAC roles permitted to authorize this application.
*   **`entryPoint` (String)**: URL endpoint where the application server runs.
*   **`routingMode` (String)**: Must be `"iframe"` (recommended for maximum sandboxing).
*   **`database` (Object - Optional)**:
    *   `requiresIsolatedSchema`: If `true`, the system provisions a dedicated SQL schema namespace for the app in PostgreSQL.
    *   `schemaName`: The custom PostgreSQL schema name.
*   **`targetRules` (Object - Optional)**: Target audience rules.
    *   `verticals`: Restricts app visibility to specific vertical departments.
    *   `designations`: Restricts visibility to specific corporate roles.
    *   `minJobLevel`: Numeric minimum job rank (e.g. Level 2+).

## 🔄 The Authentication Handshake

SG Forge operates a strict, zero-trust token exchange mechanism. Apps do not read portal session cookies. Instead:

### 1. Receiving the Auth Code (In-Memory postMessage)
When a user launches the app in the portal, the portal renders a sandboxed `iframe` pointing to your app's clean URL (without query parameters).
As soon as the iframe completes loading, the parent portal window sends a secure `postMessage` payload to the iframe containing a short-lived authorization code:

```json
{
  "type": "FORGE_AUTH_TOKEN",
  "code": "AUTH_CODE_XYZ",
  "user": {
    "id": "user-uuid",
    "name": "Employee Name",
    "email": "employee@company.com",
    "role": "user"
  }
}
```

> [!IMPORTANT]
> To comply with 2026 security standards, child applications must listen to this event and validate the sender's origin (`event.origin`) against the portal domain before handling the code.

### 2. Trading Code for Access Token (Backend-to-Backend)
On receiving the `code` via the postMessage handler, your application's backend must make a POST request to the portal core:
*   **Endpoint**: `POST http://localhost:3001/api/v1/auth/exchange`
*   **Body**:
    ```json
    {
      "code": "AUTH_CODE_XYZ",
      "client_id": "YOUR_APP_CLIENT_ID",
      "client_secret": "YOUR_APP_CLIENT_SECRET"
    }
    ```
*   **Response**: Returns an `access_token` (JWT), user information, and approved permission scopes.

---

## 🛠 Using the Forge SDK

SG Forge provides a dual-purpose SDK for client-side and server-side integration (located at `packages/sdk/forge-sdk.ts`, available via workspace dependency `@packages/sdk`).

### 1. Frontend Integration (`ForgeClient`)
Run the client helper inside your iframe's client-side javascript to automatically handle theme changes and signal platform readiness.

```typescript
import { ForgeClient } from '@packages/sdk';

const forge = new ForgeClient();

// Listen to host theme switches (light, dark, solarized, etc.)
forge.onThemeChange((payload) => {
  console.log(`Syncing app theme to: ${payload.theme}`);
});

// Notify portal host that iframe has completed loading
forge.notifyReady();
```

### 2. Backend Integration (`ForgeBackendClient`)
Use the backend helper in your app's Node/Bun server to complete auth exchanges and query user credentials.

```typescript
import { ForgeBackendClient } from '@packages/sdk';

const sdk = new ForgeBackendClient({
  baseUrl: 'http://localhost:3001',
  clientId: process.env.CLIENT_ID || '',
  clientSecret: process.env.CLIENT_SECRET || ''
});

// Perform OAuth code exchange
const authSession = await sdk.exchangeCode(code);
const token = authSession.access_token;

// Fetch full user profile
const profile = await sdk.getUserInfo(token);
console.log(`Authenticated user: ${profile.user.name}`);

// Write event to host audit logs database
await sdk.writeAuditLog(token, 'document.edited', 'INFO', { docId: '123' });
```
