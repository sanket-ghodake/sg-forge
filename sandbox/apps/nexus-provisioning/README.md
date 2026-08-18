# Nexus IT Provisioning

## 1. Context Profile
* **Domain:** Automated Internal Enterprise Hardware Asset Allocation Pipeline Control Engine.
* **Role:** A sandbox application managing IT hardware and asset allocations within organizational units.

## 2. Network Target Mappings
* **Active Port:** `8081`
* **Routing Mode:** `iframe`
* **Environment Keys Required:**
  * `CLIENT_ID`: OAuth client identifier.
  * `CLIENT_SECRET`: OAuth client secret.

## 3. Storage Tier Isolation
* **Schema Namespace:** `forge_nexus_provisioning`
* **Isolated Table Structure:** Uses isolated database schemas matching the asset allocation constraints.

## 4. Independent Execution Command
To run this application server independently:
```bash
bun run server.ts --port 8081
```
