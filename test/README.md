# Quality Assurance Workspace (`test/`)

This directory is reserved for holding test payloads, unit suites, integration paths, and coverage logs.

## Directories:
* **`apps/`:** Isolated external applications used for sandbox and integration flow testing (e.g., `example-forge-app`).
* **`dummy-data/`:** Static JSON payloads or mockup records.
* **`unit/`:** Core code logic tests.
* **`integration/`:** End-to-end user workflow simulations.
* **`scripts/`:** Orchestration and helper scripts for running test workloads (e.g., `run-example-app.sh`, `absolute-import-enforcer.ts`).
* **`coverage/`:** Automated test coverage outputs.

## Rules to Follow:
1. **Naming Conventions:** All test files must be named using the `*.test.ts` or `*.spec.ts` suffix to ensure they are picked up by the test runner automatically.
2. **Execution Runner:** Execute tests using the built-in Bun runner command from the root workspace folder:
   ```bash
   bun test
   ```
3. **Mock Data Cleanliness:** Never commit temporary test outputs or log outputs outside the `test/coverage/` and `test/dummy-data/` folders.
