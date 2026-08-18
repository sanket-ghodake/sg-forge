# SG Forge Documentation Standards & Tools Guide

This document defines the rules, tooling recommendations, and guidelines for maintaining long-term, high-quality documentation for the SG Forge platform.

---

## 🛠 Recommended Open-Source Documentation Tools

For long-term, scalable product documentation, we recommend adopting a **Docs-as-Code** model using one of the following modern, open-source static site generators:

### 1. Astro Starlight (Highly Recommended)
* **What it is:** A documentation framework built on top of Astro.
* **Why it fits:** Extremely fast (ships zero client-side JavaScript by default), gorgeous dark/light themes out of the box, built-in site search (Pagefind), tabs, callouts, and multi-language support.
* **Best for:** Multi-package monorepos and developer portals.

### 2. Docusaurus
* **What it is:** The industry-standard React-based documentation tool developed by Meta.
* **Why it fits:** Outstanding built-in support for **documentation versioning** (crucial for tracking SDK API v1, v2 changes), localization, and custom React component integration inside markdown (MDX).
* **Best for:** Rich, interactive docs with embedded playground features.

### 3. MkDocs with Material Theme
* **What it is:** A fast, simple static site generator configured via a single YAML file.
* **Why it fits:** Highly customizable, widely adopted in polyglot projects (used by FastAPI, Ruff, etc.), and supports search out of the box.
* **Best for:** Simple setup without needing Node/JS configurations.

---

## 📏 Rules for Documentation (The Docs-as-Code Manifesto)

To maintain documentation quality as the project grows, enforce the following rules:

### 1. Single Source of Truth
* All user and developer documentation must reside in the `/docs` directory of the monorepo.
* Code paths, port numbers, and configuration examples must reflect the current state in the active workspaces (e.g., refer to `sandbox/apps/` instead of the old `src/apps/`).

### 2. Automated Validation (CI/CD Gates)
* **Link Checking:** Run `lychee` (an open-source link checker) inside the toolchain to scan for broken internal/external markdown links.
* **Style Guidelines:** Use **markdownlint** (via Biome or ESLint plugins) to enforce correct heading hierarchies (e.g., exactly one `<h1>` per file).
* **Editorial Rules:** Use **Vale** (an open-source linting CLI) to enforce style guidelines (e.g., tone of voice, abbreviations, or warning against passive voice).

### 3. Structural Hierarchy
All documentation should fit into one of four categories (The Diátaxis Framework):
1. **Tutorials:** Learning-oriented step-by-step guides for beginners (e.g., "Getting Started with Sandbox").
2. **How-To Guides:** Goal-oriented recipes for solving specific tasks (e.g., "How to register a custom python micro-app").
3. **Reference:** Information-oriented schemas, API endpoints, and configuration parameters (e.g., "App Manifest JSON Schema Reference").
4. **Explanation:** Understanding-oriented architecture concepts and design decisions (e.g., "Org Canvas meso/macro state design").

---

## 📂 Proposed `/docs` Directory Layout

Keep files clean and structured by organizing them into designated sub-directories:

```text
docs/
├── architecture/          # Architecture design specs, diagrams, and vision documents
│   └── org-canvas.md
├── guides/                # Step-by-step developer tutorials
│   ├── app-registration.md
│   └── database-migrations.md
├── references/            # API specifications and schemas
│   ├── manifest-schema.json
│   └── core-api-v1.md
├── operations/            # Deployment, Docker setup, and local runtimes
│   ├── production-deployment.md
│   └── wsl-setup.md
└── DOCUMENTATION_STANDARDS.md # This file
```
