# Telemetry Dashboard

This is a sandboxed Forge micro-app generated for the SG Forge portal.

## Configuration Details
*   **Slug**: `telemetry-dashboard`
*   **Port**: `8080`
*   **Database Schema**: `forge_telemetry_dashboard`

## How it works
1.  **Process Spawning**: The dynamic app runner (`scripts/dynamic-app-runner.ts`) automatically launches the server.
2.  **Reverse Proxy**: In Docker dev mode, requests to `/forge-apps/telemetry-dashboard` route to your server port internally.
3.  **Authentication**: When loaded in the portal, your app's entryPoint receives an auth `?code=` parameters. Exchange it via `POST /api/v1/auth/exchange` to fetch the JWT user profile.
