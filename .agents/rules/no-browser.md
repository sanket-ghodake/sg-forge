

## no-browser

Do NOT open or interact with the browser (using the `browser_subagent` tool or any browser automation) unless the USER **explicitly** instructs you to do so with clear wording such as "open the browser", "test in the browser", "check in the browser", or similar direct requests.

Rules:
- Never auto-launch the browser to verify code changes — make code fixes and let the user test manually.
- Never use `browser_subagent` to "confirm" UI rendering or check routes unless asked.
- If you need to understand a page's behavior, read the source code instead of opening a browser.
- When a fix is complete, tell the user what was changed and ask them to test manually.
