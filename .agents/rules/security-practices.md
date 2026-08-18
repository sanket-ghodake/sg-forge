# Security Practices Guide

## 1. Database Access & Role Segregation
Never write `db.execute(sql.raw(...))` outside of verified administrative control nodes. Always write negative path integration tests (`test/integration/security.test.ts`) validating that a 403 error is thrown for standard users on restricted assets.

## 2. SAST (Semgrep) & Secret Scanning (Gitleaks) Bypass Policy
When encountering false positives from static analysis (SAST/Semgrep) or secret scanners, developers and agents must adhere to the following rules:

1. **Mandatory Input Validation First**: Never suppress a SAST warning (using `// nosemgrep`) without first implementing robust runtime validation (e.g., regex checks, type checking, or allowlists) immediately before the flagged statement.
2. **Use Same-Line Suppressions Carefully**: For multi-line statements, place the `// nosemgrep` comment on the exact line flagged in the scanner output (typically the line containing the interpolated variable or template string).
3. **Prefer Specific Rule IDs**: Where possible, specify the rule ID (e.g., `// nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal`) rather than generic `// nosemgrep` to avoid creating security blind spots for unrelated findings.
4. **Required Explanatory Comments**: Precede every suppression directive with a code comment explaining *why* the bypass is safe and referencing the validation/mitigation logic used.
5. **No Secret Suppression Bypasses**: Never bypass a Gitleaks or secret scanner warning using `gitleaks:allow` comments for actual production secrets or credentials. Secret scanning warnings must be resolved by using environment variables, config files, or secret managers.

