---
trigger: always_on
description: Use rtk commands to conserve token consumption and minimize output overhead in terminal sessions.
---

## rtk

This project has the `rtk` CLI utility installed to optimize LLM token usage and compress terminal outputs.

Rules:
- For terminal commands, always prefix or wrap your execution using `rtk` when running commands that support it (e.g., git, next, lint, tsc, prettier, format, test, find, tree, ls, psql, npm, npx).
- Example command optimizations:
  - Git: use `rtk git status`, `rtk git add .`, `rtk git commit -m "..."`, `rtk git diff`
  - TypeScript: use `rtk tsc`
  - Next.js build: use `rtk next build`
  - Linting: use `rtk lint`
  - Formatting check: use `rtk format` or `rtk prettier`
  - Runs/tests: use `rtk test` or `rtk err <command>` to show only errors
- Never output raw commands if there is a matching `rtk` subcommand.
- Use `rtk smart` to generate short summaries.
