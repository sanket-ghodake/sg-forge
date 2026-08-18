# Apex Expense Claims

## 1. Context Profile
* **Domain:** Corporate Expense Submission Ledger.
* **Role:** A sandbox application for expense submission linked directly to organizational reporting managers.

## 2. Network Target Mappings
* **Active Port:** `8082`
* **Routing Mode:** `iframe`
* **Environment Keys Required:**
  * `CLIENT_ID`: OAuth client identifier.
  * `CLIENT_SECRET`: OAuth client secret.

## 3. Storage Tier Isolation
* **Schema Namespace:** `forge_apex_expenses`
* **Isolated Table Structure:** Uses isolated database schemas matching the organizational reporting guidelines.

## 4. Independent Execution Command
To run the service container or server for this app:
```bash
bun run server.ts --port 8082
```
