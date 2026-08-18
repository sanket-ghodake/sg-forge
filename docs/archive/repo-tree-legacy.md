# Repository Tree (Legacy)
```text
# To regenerate or update this tree of important files, run:
# rtk tree -I "node_modules|.git|portables|graphify-out|dist|.next|cache|*.tsbuildinfo"

.
├── bun.lock
├── currently_working.md
├── docker
│   ├── dev
│   └── prod
├── docs
│   ├── forge_sdk_rules.md
│   ├── history
│   │   ├── 01_initial_backend_setup.md
│   │   ├── 02_frontend_sql_workbench.md
│   │   ├── 03_database_auth_logging.md
│   │   ├── 04_plug_and_play_apps_architecture.md
│   │   ├── 05_bun_testing_and_seeding_suite.md
│   │   ├── 06_architectural_blueprint.md
│   │   ├── 07_interactive_canvas_and_onboarding.md
│   │   ├── 08_auth_cookie_fix_and_admin_redesign.md
│   │   ├── 09_multi_theme_system.md
│   │   ├── design_system_migration.md
│   │   └── README.md
│   ├── project_context.md
│   ├── repo-tree.txt
│   └── system_guide.md
├── package.json
├── README.md
├── scripts
│   ├── docker
│   ├── portable
│   ├── README.md
│   ├── run.bat
│   ├── run.sh
│   ├── setup.bat
│   └── setup.sh
├── src
│   ├── apps
│   │   ├── apex-expenses
│   │   │   └── app.json
│   │   ├── billing
│   │   │   ├── app.json
│   │   │   └── index.tsx
│   │   ├── employees
│   │   │   ├── app.json
│   │   │   └── index.tsx
│   │   ├── nexus-provisioning
│   │   │   └── app.json
│   │   └── README.md
│   ├── backend
│   │   ├── api
│   │   │   ├── admin
│   │   │   │   └── queryEngine.ts
│   │   │   └── user
│   │   │       └── portal.ts
│   │   ├── auth
│   │   │   └── sessionManager.ts
│   │   ├── dev-dashboard
│   │   │   ├── dashboard.html
│   │   │   └── server.ts
│   │   ├── middleware
│   │   │   └── authGuard.ts
│   │   ├── README.md
│   │   ├── utils
│   │   │   ├── logger.ts
│   │   │   └── manifestParser.ts
│   │   └── workers
│   ├── database
│   │   ├── connection.ts
│   │   ├── initialize-local-db.ts
│   │   ├── README.md
│   │   ├── schema.ts
│   │   └── seed.ts
│   ├── frontend
│   │   ├── AGENTS.md
│   │   ├── app
│   │   │   ├── api
│   │   │   │   ├── admin
│   │   │   │   │   ├── bulk-ingest
│   │   │   │   │   │   └── route.ts
│   │   │   │   │   ├── metadata
│   │   │   │   │   │   └── route.ts
│   │   │   │   │   └── sandbox-sync
│   │   │   │   ├── apps
│   │   │   │   │   └── route.ts
│   │   │   │   ├── auth
│   │   │   │   │   ├── login
│   │   │   │   │   │   └── route.ts
│   │   │   │   │   ├── logout
│   │   │   │   │   │   └── route.ts
│   │   │   │   │   ├── reset-password
│   │   │   │   │   │   └── route.ts
│   │   │   │   │   └── session
│   │   │   │   │       └── route.ts
│   │   │   │   ├── forge-apps
│   │   │   │   │   └── [slug]
│   │   │   │   │       └── [[...path]]
│   │   │   │   │           └── route.ts
│   │   │   │   ├── logs
│   │   │   │   │   └── route.ts
│   │   │   │   └── query
│   │   │   │       └── route.ts
│   │   │   ├── apps
│   │   │   │   └── [appId]
│   │   │   │       └── page.tsx
│   │   │   ├── components
│   │   │   │   ├── AdminPanel.tsx
│   │   │   │   ├── SettingsPanel.tsx
│   │   │   │   └── UserLaunchpad.tsx
│   │   │   ├── force-reset
│   │   │   │   └── page.tsx
│   │   │   ├── forge-apps
│   │   │   │   └── [slug]
│   │   │   │       └── [[...path]]
│   │   │   │           └── route.ts
│   │   │   ├── globals.css
│   │  │   ├── layout.tsx
│   │   │   ├── login
│   │   │   │   └── page.tsx
│   │   │   ├── page.tsx
│   │   │   └── user
│   │   │       └── page.tsx
│   │   ├── bun.lock
│   │   ├── CLAUDE.md
│   │   ├── components
│   │   │   ├── canvas
│   │   │   ├── ingest
│   │   │   └── workbench
│   │   ├── eslint.config.mjs
│   │   ├── middleware.ts
│   │   ├── next.config.ts
│   │   ├── next-env.d.ts
│   │   ├── package.json
│   │   ├── postcss.config.mjs
│   │   ├── README.md
│   │   ├── tsconfig.json
│   │   └── tsconfig.tsbuildinfo
│   └── README.md
├── tailwind.config.ts
└── test
    ├── dummy-data
    │   ├── company_data.csv
    │   ├── company_data.json
    │   └── generate-mock-data.ts
    ├── integration
    │   ├── authGuard.test.ts
    │   └── forge-apps-allocation.test.ts
    ├── README.md
    └── unit
        ├── queryEngine.test.ts
        └── session.test.ts
```
