# Plug-and-Play Application Workspace (`src/apps/`)

This directory is reserved as an isolated sandbox for future sub-applications or modular custom plugins.

## Rules to Follow:
1. **Isolated Compilation:** Every application added here must live in its own self-contained subdirectory (e.g. `src/apps/billing/`).
2. **Zero Core Modifications:** Do not edit the parent backend/frontend repository files to load an application. Sub-apps should resolve dynamically or build as decoupled workspace directories.
3. **Internal Styling:** Any custom sub-app should read the global variables in `globals.css` to respect the system themes (Light, Dark, Cyberpunk).
