# SG Forge Platform

Welcome to the comprehensive documentation for the SG Forge Organization Manager monorepo platform.

This platform houses the core Next.js portal host, identity management layers, a hierarchical organizational database model, and an isolated multi-language extension sandbox.

---

## ⚡ Platform Highlights

*   **Secured App Isolation**: Run untrusted, multi-language sandbox applications (TypeScript, Python, Go) under tight OAuth/scope isolation boundaries.
*   **Hierarchical Org Engine**: Configure deep vertical-based permission structures, nested roles, and dynamically resolve application entitlement.
*   **Dual Runtime Setups**: Easily spin up the entire system via Docker-Compose containers or locally with native Portable runtimes.
*   **Interactive Workbench**: Execute secure database actions using role-restricted query engines and audit logs.

---

## 🧭 Navigation Map

*   **[Overview](overview/introduction.md)**: Introduction to the platform, project vision & decisions, and the monorepo repository tree.
*   **[Guides](guides/installation.md)**: Getting started, local installation, Docker environment setup, WSL compatibility configurations, the [App Developer Guide](guides/app-developer.md), the comprehensive [App Integration Guide](guides/app-integration.md), and the [Windows Fixes Summary](guides/windows-fixes-summary.md).
*   **[Architecture & Design](architecture/system.md)**: System topology, shared SDK contract spec, vertical-horizontal access engines, core security blueprints, [timezone resiliency configurations](architecture/timezone-resiliency.md), and the [Secure Software Development Lifecycle (SSDLC) Blueprint](architecture/ssdlc.md).
