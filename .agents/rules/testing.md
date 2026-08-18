# Agent Rules: Testing Enforcement

1. Every exported package and core module MUST have tests.
2. Code coverage MUST remain >80%. Run unit tests via `rtk bun test test/unit`.
3. Mock all external networks, APIs, and host filesystem calls during unit tests.
4. No network requests during unit test execution.
