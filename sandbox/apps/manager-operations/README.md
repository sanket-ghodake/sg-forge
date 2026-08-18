# Manager Operations Dashboard

## 1. Context Profile
* **Domain:** Management Intelligence, Resource Allocations, and Team Telemetry.
* **Role:** A dashboard widget supplying core operations tracking, designation telemetry, and job level access filters.

## 2. Network Target Mappings
* **Active Port:** N/A (Runs as local UI component)
* **Routing Mode:** `local` (Integrated React module)
* **Environment Keys Required:** None.

## 3. Storage Tier Isolation
* **Schema Namespace:** N/A (Queries metadata and logs via main Next.js APIs)
* **Isolated Table Structure:** None.

## 4. Independent Execution Command
Because this application runs in `local` routing mode (compiled dynamically by the core portal), it cannot be booted independently. Run it by booting the core platform:
```bash
bun --cwd ./core run dev
```
