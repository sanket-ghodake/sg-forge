# System Architecture

This document details the design patterns, runtime models, database schema, and components that make up the SG Forge platform.

---

## 🏗 System Topology

SG Forge operates as a hybrid monolithic portal serving federated, isolated micro-applications:

```mermaid
graph TD
    User([User Browser]) -->|HTTPS / Port 3003| Proxy[Developer Proxy Gateway]
    Proxy -->|Core Routes / Port 3001| Portal[Next.js Portal Core]
    Proxy -->|Apps Routing / Ports 8085-8087| Apps[Sandbox App Servers]
    
    Portal -->|JWT Cookie Check| AuthGuard[Auth Guard Middleware]
    Portal -->|Iframe Wrapper| Canvas[Semantic Org Canvas]
    
    subgraph "Sandbox Micro-Apps"
        Apps -->|Iframe Render| AppA[Go Task App :8086]
        Apps -->|Iframe Render| AppB[Python Docs App :8087]
        Apps -->|Iframe Render| AppC[Expenses App :8085]
    end

    AppA -->|REST APIs & SDK| Portal
    AppB -->|REST APIs & SDK| Portal
    AppC -->|REST APIs & SDK| Portal

    Portal -->|Drizzle ORM| Postgres[(PostgreSQL Database)]
    AppC -->|Isolated Schema| Postgres
```

---

## 🛠 Core Components

### 1. Next.js Portal Core (`core/`)
*   **Routing**: Next.js App Router for layouts, onboarding screens, administrative consoles, and dynamic iframe canvases.
*   **Auth Guard Middleware (`core/src/frontend/middleware.ts`)**: Intercepts unauthenticated routes, verifying JWT session cookies and enforcing mandatory password resets for new accounts.

### 2. App Engine Registry & Manifest Scanner
*   **App Configuration (`app.json`)**: Declares app slugs, descriptions, entry point URLs, target audience rules (verticals, designations, levels), and database preferences.
*   **Sync Pipeline (`core/src/backend/utils/manifestParser.ts`)**: Scans folders under `sandbox/apps/` on startup, registers new applications inside the `forge_apps` table, and automatically provisions unique Client IDs and Secrets.

### 3. Interactive Semantic Org Canvas
An infinite-grid workspace supporting zoom-dependent card rendering:
*   **Macro View (Zoom < 80%)**: Bento-Box layout displaying departmental summaries and total member counts.
*   **Meso View (80% - 140% Zoom)**: Employee clusters mapped to their managers via dynamic SVG paths.
*   **Micro View (Zoom >= 140%)**: Detailed profile cards showcasing EID, name, designation, and status indicators.

---

## 🗄 Database Schema Matrix

The database layer stores its structures in PostgreSQL, separated into four areas:

```mermaid
erDiagram
    USERS {
        uuid id PK
        varchar eid
        varchar name
        varchar email
        varchar password_hash
        boolean is_password_changed
        integer job_level
        uuid designation_id FK
        uuid vertical_id FK
        uuid manager_id FK
    }
    FORGE_APPS {
        varchar id PK
        varchar slug
        varchar name
        varchar entry_point
        varchar client_id
        varchar client_secret
        jsonb target_rules
    }
    SYSTEM_LOGS {
        uuid id PK
        timestamp timestamp
        varchar user_id
        varchar event_type
        varchar severity
        jsonb payload
    }
    STRUCTURAL_METADATA {
        uuid id PK
        varchar name
        varchar type
        uuid parent_id FK
    }

    USERS ||--o| USERS : reports_to
    USERS }|--|| STRUCTURAL_METADATA : belongs_to
    SYSTEM_LOGS }|--|| USERS : references
```
