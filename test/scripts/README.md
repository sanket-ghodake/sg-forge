# Test Workspace Scripts (`test/scripts/`)

This directory contains test-specific execution and validation scripts.

## Scripts

*   **`run-example-app.sh`**: Helper script to run the containerized `example-forge-app` compose stack independently for oauth integration testing.
*   **`absolute-import-enforcer.ts`**: Static analysis helper that checks files to ensure no relative paths are used for imports or exports across workspace boundary layers. (Also executed as part of the unit test suite).
