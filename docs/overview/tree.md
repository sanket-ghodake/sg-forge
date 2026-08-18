# Repository Tree

Below is the directory tree of the refactored monorepo. This layout separates the core application code, shared package utilities, sandbox micro-applications, configurations, and test suites.

```text
.
├── bunfig.toml
├── bun.lock
├── config
│   ├── biome.json
│   ├── envs
│   │   ├── docker.development.env
│   │   ├── docker.production.env
│   │   ├── portable.development.env
│   │   └── portable.production.env
│   └── tsconfig.base.json
├── core
│   ├── drizzle.config.ts
│   ├── package.json
│   ├── README.md
│   └── src
│       ├── backend
│       ├── database
│       └── frontend
├── docker
│   ├── docker-compose.yaml
│   ├── docker-entrypoint.sh
│   └── Dockerfile
├── docs
│   ├── archive
│   │   └── [historical documentation md/txt files]
│   ├── history
│   │   └── [historical architecture notes]
│   ├── index.md
│   ├── overview/
│   ├── guides/
│   └── architecture/
├── mkdocs.yml
├── package.json
├── packages
│   └── sdk
│       ├── forge-sdk.ts
│       ├── package.json
│       └── README.md
├── README.md
├── run.sh
├── sandbox
│   ├── apps
│   │   ├── apex-expenses
│   │   ├── billing
│   │   ├── employees
│   │   ├── example-forge-app
│   │   ├── manager-operations
│   │   ├── nexus-provisioning
│   │   ├── README.md
│   │   ├── reference-expenses
│   │   ├── reference-go
│   │   └── reference-python
│   └── README.md
├── scripts
│   ├── developer-proxy.ts
│   ├── README.md
│   ├── replace-relative-imports.py
│   ├── run.bat
│   ├── run-dev.sh
│   ├── setup.bat
│   └── setup.sh
├── test
│   ├── apps
│   │   └── example-forge-app
│   ├── dummy-data
│   ├── integration
│   ├── README.md
│   ├── scripts
│   │   ├── absolute-import-enforcer.ts
│   │   └── run-example-app.sh
│   └── unit
├── toolchain
│   ├── docker-compose.yml
│   ├── Dockerfile
│   ├── README.md
│   └── run-checks.sh
└── tsconfig.json
```

### Path Map Details

*   **`core/`**: Host for frontend pages/components, API endpoints, backend logic, and database migrations.
*   **`packages/`**: Workspace containing utility packages, specifically `@packages/sdk` imported by sandbox apps.
*   **`sandbox/`**: Contains micro-apps written in TS/JS, Python, and Go, showcasing multi-language federation.
*   **`config/envs/`**: Central location for docker and portable environment parameters split between development and production.
*   **`toolchain/`**: Docker container wrapping test, format, and static analysis checkers to preserve system clean state.
