# Billing Operations Sandbox App

## 1. Context Profile
* **Domain:** Decoupled Workspace Billing.
* **Role:** A mockup widget representing enterprise billing, invoice tracking, and transaction logging engine.

## 2. Network Target Mappings
* **Active Port:** N/A (Integrated UI Component)
* **Routing Mode:** `react-component`
* **Environment Keys Required:** None.

## 3. Storage Tier Isolation
* **Schema Namespace:** N/A
* **Isolated Table Structure:** None.

## 4. Independent Execution Command
This application runs as an integrated `react-component` within the host dashboard. To test it, boot the main development server:
```bash
bun --cwd ./core run dev
```
