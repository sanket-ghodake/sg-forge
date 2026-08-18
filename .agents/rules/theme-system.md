## theme-system

Rules:
- Always use the centralized CSS variables for colors, spacing, and borders defined in `globals.css`. Do NOT define ad-hoc style values or hardcode hex colors.
- Forge Apps must declare a `"ui"` inheritance policy in their `app.json` configuration and subscribe to the host theme settings via postMessage or properties.
- Do NOT add standalone font options or bypass the central `data-theme` or `data-font` parameters on the root document element.
