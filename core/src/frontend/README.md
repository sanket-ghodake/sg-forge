# Frontend Workspace (`src/frontend/`)

This directory is a standalone Next.js App Router application built using Bun.

## Structure:
* **`app/`:** App Router pages.
  * **`layout.tsx`:** Standard layout wrapping application views.
  * **`globals.css`:** Dynamic theme styles utilizing Tailwind CSS v4 design tokens.
  * **`page.tsx`:** Main corporate dashboard containing the SQL workbench and theme presets.
  * **`login/page.tsx`:** Security verification login panel.
  * **`force-reset/page.tsx`:** Security update panel to force default password reset.
  * **`api/query/route.ts`:** API endpoint forwarding safe administrative queries to PostgreSQL.
* **`middleware.ts`:** Front-end router gate that routes users through `src/backend/middleware/authGuard.ts`.

## Rules to Follow:
1. **Dynamic Theme Tokens:** Never hardcode colors (e.g. `bg-gray-100`, `text-black`) inside dashboard interfaces. Always use the HSL Tailwind CSS v4 variables defined in `globals.css`:
   * Backgrounds: `bg-background-portal` / `var(--bg-portal)`
   * Cards: `bg-surface-card` / `var(--surface-card)`
   * Text: `text-text-primary` / `var(--text-primary)`
   * Brand Highlight: `text-brand-accent` / `var(--brand-accent)`
2. **Infinite Redirect Prevention:** If you add any page route that should be publicly accessible before logging in, remember to add it to the exclusion list in the `config.matcher` array inside `src/frontend/middleware.ts`.
3. **Execution Scripts:** Launch the frontend development server using `bun run dev` or through the orchestrator wrappers `scripts/run.sh`.
