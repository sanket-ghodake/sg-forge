# Isolated Example Forge App

## 1. Context Profile
* **Domain:** Independent Containerized Third-Party Application.
* **Role:** Serves as a standalone isolated demonstration application running on port 8090 with its own backend and frontend code to demonstrate secure SSO/OAuth authorization flows.

## 2. Network Target Mappings
* **Active Port:** `8090`
* **Routing Mode:** `standalone`
* **Environment Keys Required:**
  * `PORT`: `8090`
  * `CLIENT_ID`: `client_example_forge_app`
  * `CLIENT_SECRET`: `secret_example_forge_app`
  * `PORTAL_INTERNAL_URL`: Internal backchannel to the portal framework (e.g. `http://app:3001` or `http://localhost:3001`).

## 3. Storage Tier Isolation
* **Schema Namespace:** N/A (Connects to its own isolated Postgres database instance `example_forge_db` rather than using schema namespaces in the main DB).

## 4. Independent Execution Command
To run this application independently, execute the orchestration script from the root:
```bash
./test/scripts/run-example-app.sh
```
Or run its docker compose directly from the test folder:
```bash
docker compose -f test/apps/example-forge-app/docker-compose.yml up -d --build
```
