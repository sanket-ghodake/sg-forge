<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Agent Directives: Token Optimization & Tooling

To conserve LLM tokens and make interactions highly efficient, the environment has the `rtk` (Rust Token Killer) CLI tool installed.

- **RTK Usage:** Always use `rtk` to proxy and condense terminal outputs.
- **Git:** Use `rtk git status`, `rtk git add .`, `rtk git commit`, `rtk git diff`.
- **Node/Bun commands:** Use `rtk npm ...`, `rtk npx ...`, `rtk tsc`, `rtk next`, `rtk lint`.
- **Logs & Errors:** Use `rtk err <command>` or `rtk test` to focus exclusively on failure outputs.
