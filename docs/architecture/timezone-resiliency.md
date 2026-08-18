# Timezone Resiliency & DB Driver Date Normalization

This document explains the root cause, systemic threat, and architectural solution for timezone/clock offset skews between the PostgreSQL database and the Next.js Portal host.

---

## 1. Context & Root Cause Analysis

The SG Forge database schema utilizes the `timestamp` column type (without timezone) for time-sensitive records, such as:
*   `expires_at` in `forge_auth_codes` (OAuth authorization codes, 30s TTL).
*   `expires_at` in `forge_access_tokens` (SSO session bearer tokens, 1hr TTL).
*   `expires_at` in `forge_app_entitlements` (marketplace break-glass access).

When the database is running inside Docker (which defaults to UTC) but the Portal backend is running natively on a host machine in a local timezone (e.g., `IST` / `UTC+5:30`), queries return dates under varying structures.

### The Parsing Loophole
When querying using ORM schemas, database drivers often parse timestamps automatically. However, when executing raw query expressions via Drizzle's `db.execute(sql`...`)`, the returned datasets bypass normal mapping layers.
As a result, the `pg` (node-postgres) driver returns raw dates as plain, timezone-less string values:
```javascript
// Example returned row value
const expiresAt = '2026-06-17 01:34:14.87703';
```

When Javascript evaluates `new Date(expiresAt)`, the browser/Node runtime follows standard ECMAScript parsing:
*   Strings with timezone offsets (e.g. ending in `Z` or `+05:30`) are parsed using that timezone.
*   Strings **without** timezone offsets are parsed using the **system's local timezone**.

On an IST host, `2026-06-17 01:34:14.877` (which was saved in UTC) is parsed as **`01:34:14 IST`**. In UTC terms, this equates to `2026-06-16 20:04:14 UTC` (5.5 hours in the past). 
Because the parsed date is skewed backwards, the expiration validation check:
```typescript
if (new Date(token.expiresAt) < new Date()) {
  return NextResponse.json({ error: 'Expired' }, { status: 401 });
}
```
immediately evaluates to `true`, instantly invalidating newly generated codes and tokens.

---

## 2. The Architectural Solution

To resolve this system-wide without modifying schema definitions or columns, we implemented a centralized UTC date parser utility.

### Centralized Date Parser
A timezone-aware helper was established at `core/src/backend/utils/date.ts`:
```typescript
export function parseDbTimestamp(val: any): Date {
  if (val instanceof Date) {
    return val;
  }
  if (typeof val === 'string') {
    // If it doesn't contain a timezone suffix/offset at the end, force parse it as UTC
    if (!val.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(val)) {
      // Replace whitespace separator with 'T' and suffix 'Z'
      return new Date(val.replace(' ', 'T') + 'Z');
    }
    return new Date(val);
  }
  return new Date(val);
}
```

### Applied API Endpoints
All expiration and date checking logic in Next.js backend API routes have been updated to utilize `parseDbTimestamp` before comparison:
1.  **`/api/v1/auth/exchange`**: Verifies authorization code expiration times during OAuth handshake swaps.
2.  **`/api/v1/user`**: Validates the expiration of micro-app bearer access tokens.
3.  **`/api/v1/permissions`**: Verifies scopes and permissions under token validation bounds.
4.  **`/api/v1/audit/log`**: Validates log write access scope limits against active token lifetimes.
5.  **`/api/v1/org/context`**: Authorizes organization context access.
6.  **`/api/v1/org/hierarchy/verify-relationship`**: Validates requester SSO token validation status.

---

## 3. Testing & Verification

To prevent regression, a comprehensive test suite was written in `test/unit/date.test.ts`:
*   **Identity Mapping**: Ensures `Date` objects returned by database connection pool parsers pass through unchanged.
*   **UTC Coercion**: Validates that raw strings without timezone indicators are parsed using UTC (zero local offset skew).
*   **ISO Conformity**: Verifies that standard `Z`-terminated strings parse to correct UTC moments.
*   **Offset Integrity**: Confirms that explicit timezone markers (like `+05:30` or `-08:00`) are respected properly.
