// src/backend/api/admin/queryEngine.ts
import { db, roDb } from "@database/connection";
import { sql } from "drizzle-orm";

interface SqlToken {
  type: "keyword" | "string" | "identifier" | "operator" | "whitespace";
  value: string;
}

export function tokenizeSql(sqlStr: string): SqlToken[] {
  const tokens: SqlToken[] = [];
  let i = 0;
  const len = sqlStr.length;

  while (i < len) {
    const char = sqlStr[i];

    // 1. Whitespace
    if (/\s/.test(char)) {
      let val = "";
      while (i < len && /\s/.test(sqlStr[i])) {
        val += sqlStr[i];
        i++;
      }
      tokens.push({ type: "whitespace", value: val });
      continue;
    }

    // 2. Single-line comment
    if (char === "-" && sqlStr[i + 1] === "-") {
      i += 2;
      while (i < len && sqlStr[i] !== "\n" && sqlStr[i] !== "\r") {
        i++;
      }
      continue;
    }

    // 3. Multi-line comment (can be nested in PostgreSQL)
    if (char === "/" && sqlStr[i + 1] === "*") {
      i += 2;
      let depth = 1;
      while (i < len && depth > 0) {
        if (sqlStr[i] === "/" && sqlStr[i + 1] === "*") {
          depth++;
          i += 2;
        } else if (sqlStr[i] === "*" && sqlStr[i + 1] === "/") {
          depth--;
          i += 2;
        } else {
          i++;
        }
      }
      continue;
    }

    // 4. Quoted Identifier (e.g. "users")
    if (char === '"') {
      let val = "";
      i++;
      while (i < len) {
        if (sqlStr[i] === '"') {
          if (sqlStr[i + 1] === '"') {
            val += '"';
            i += 2;
          } else {
            i++;
            break;
          }
        } else {
          val += sqlStr[i];
          i++;
        }
      }
      tokens.push({ type: "identifier", value: val });
      continue;
    }

    // 5. String Literal (e.g. 'Arthur')
    if (char === "'") {
      let val = "";
      i++;
      while (i < len) {
        if (sqlStr[i] === "'") {
          if (sqlStr[i + 1] === "'") {
            val += "'";
            i += 2;
          } else {
            i++;
            break;
          }
        } else {
          val += sqlStr[i];
          i++;
        }
      }
      tokens.push({ type: "string", value: val });
      continue;
    }

    // 6. Dollar-quoted String (e.g. $$my string$$)
    if (char === "$") {
      let j = i + 1;
      while (j < len && /[a-zA-Z0-9_]/.test(sqlStr[j])) {
        j++;
      }
      if (j < len && sqlStr[j] === "$") {
        const tag = sqlStr.substring(i, j + 1);
        i = j + 1;
        let val = "";
        while (i < len) {
          if (sqlStr.startsWith(tag, i)) {
            i += tag.length;
            break;
          } else {
            val += sqlStr[i];
            i++;
          }
        }
        tokens.push({ type: "string", value: val });
        continue;
      }
    }

    // 7. Word/Keyword/Unquoted Identifier
    if (/[a-zA-Z_]/.test(char)) {
      let val = "";
      while (i < len && /[a-zA-Z0-9_$]/.test(sqlStr[i])) {
        val += sqlStr[i];
        i++;
      }
      tokens.push({ type: "keyword", value: val });
      continue;
    }

    // 8. Operators and Punctuation
    tokens.push({ type: "operator", value: char });
    i++;
  }

  return tokens;
}

export async function executeAdminQuery(sqlInputStr: string, adminRole: string) {
  // Hard execution block for read-only administration profiles, standard users, and standard admins
  if (adminRole !== "super_admin") {
    const destructiveKeywords = new Set([
      "drop",
      "delete",
      "truncate",
      "update",
      "insert",
      "alter",
      "create",
      "grant",
      "revoke",
      "copy",
      "call",
      "rename",
      "do",
      "execute",
    ]);

    const tokens = tokenizeSql(sqlInputStr);
    const activeTokens = tokens.filter((t) => t.type !== "whitespace");

    const hasDestructive = activeTokens.some((token, idx) => {
      if (token.type !== "keyword") return false;
      const val = token.value.toLowerCase();
      if (destructiveKeywords.has(val)) {
        return true;
      }
      // Block EXPLAIN ANALYZE (but allow safe EXPLAIN SELECT)
      if (val === "explain") {
        const nextToken = activeTokens[idx + 1];
        if (
          nextToken &&
          nextToken.type === "keyword" &&
          nextToken.value.toLowerCase() === "analyze"
        ) {
          return true;
        }
      }
      return false;
    });

    if (hasDestructive) {
      throw new Error("Privilege Violation: Read-only accounts cannot run destructive queries.");
    }
  }

  // Super admin routes to writable db pool; others route to roDb read-only pool
  const targetDb = adminRole === "super_admin" ? db : roDb;
  const result = await targetDb.execute(sql.raw(sqlInputStr));
  return result;
}
