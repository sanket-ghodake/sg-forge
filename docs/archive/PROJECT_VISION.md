# SG Forge Project Vision

SG Forge is a standalone, plug-and-play organizational workspace portal and secure sandbox container engine designed to orchestrate internal micro-frontends (Forge Apps) with strict sandboxing and unified authentication.

## 🎯 Target Audience
* **Solo Founders:** Deploy a complete corporate portal with single-command ease on low-spec Virtual Private Servers (VPS).
* **Small Dev Teams / IT Ops:** Manage internal tooling, employee directories, database administration, and custom business workflow engines without the overhead of heavy enterprise portals.
* **Open Source Communities:** Build extensible web platforms where third-party contributors can write safe, isolated micro-apps using standard web technologies.

## 💡 Core Philosophy
1. **Developer Experience First:** Booting the platform, registering an app, and launching a local testing environment must happen in seconds with zero configuration.
2. **Strict Iframe Sandboxing:** Host applications written in any language (Go, Python, Node, Rust) with total security. No arbitrary script execution, cookie leakage, or DOM traversal from client extensions.
3. **Decoupled Architecture:** Applications communicate with the host portal strictly via standard, secure Web PostMessage contracts and OAuth 2.0 API token flows.
4. **Low Footprint:** Avoid expensive micro-service orchestration. The portal functions as a single self-contained application, optionally packaged alongside a PostgreSQL database inside a single Docker Compose script.
5. **Vibrant Aesthetics:** Reject the boring look of traditional enterprise portals. SG Forge embraces high-end design, neon accent colors, smooth transitions, and instant user personalization.

## 🛠 Strategic Roadmap
* **v0.1.0 (Current):** Stabilize core portal features, establish robust Docker Compose configurations, verify Linux & WSL installations, write developer onboarding documents, and implement strict security access-control gates.
* **v0.2.0:** Introduce dynamic application store/catalog registration, permission approval request UI, and real-time WebSocket notifications.
* **v0.3.0:** Build out CLI generators (`forge-cli`) for rapid application scaffolding in Go, Python, and TypeScript.
