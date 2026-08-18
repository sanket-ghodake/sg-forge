import { describe, expect, test } from "bun:test";
import * as fs from "fs";
import * as path from "path";

// Helper function to recursively find all files in a directory
function getFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = entries.flatMap((entry) => {
    const res = path.resolve(dir, entry.name); // nosemgrep
    if (entry.isDirectory()) {
      // Skip common dependency and build folders
      if (["node_modules", ".git", ".next", "graphify-out", "portables"].includes(entry.name)) {
        return [];
      }
      return getFiles(res);
    } else {
      return res;
    }
  });
  return files;
}

describe("Relative Import Enforcer", () => {
  test("No code should use relative paths for imports/exports", () => {
    const projectRoot = process.cwd();
    const searchDirs = ["core/src", "sandbox/apps", "packages/sdk", "test"];
    const files: string[] = [];

    for (const dirName of searchDirs) {
      const dirPath = path.resolve(projectRoot, dirName);
      files.push(...getFiles(dirPath));
    }

    // Filter for TypeScript/JavaScript files, excluding this test file itself, declaration files (.d.ts), and the bundled dashboard.js
    const targetFiles = files.filter((file) => {
      const isCodeFile =
        file.endsWith(".ts") ||
        file.endsWith(".tsx") ||
        file.endsWith(".js") ||
        file.endsWith(".jsx");
      const isDts = file.endsWith(".d.ts");
      const isSelf = file === __filename;
      const isBundledAsset = file.endsWith("dev-dashboard/dashboard.js");
      const isTestApp = file.includes("test/apps/");
      return isCodeFile && !isDts && !isSelf && !isBundledAsset && !isTestApp;
    });

    // Match imports, exports and requires using relative paths
    // e.g. import ... from "./foo" or import("../../foo") or require("./bar")
    const relativeImportRegex =
      /(?:import|export)\s+(?:(?:\*|[\w\s{},]*)\s+from\s+)?['"](\.\.?\/[^'"]*)['"]|import\(['"](\.\.?\/[^'"]*)['"]\)|require\(['"](\.\.?\/[^'"]*)['"]\)/g;

    const violations: string[] = [];

    for (const file of targetFiles) {
      const content = fs.readFileSync(file, "utf8");

      // Basic comment stripping to avoid checking imports in comments
      const cleanContent = content
        .replace(/\/\*[\s\S]*?\*\//g, "") // Block comments
        .replace(/\/\/.*/g, ""); // Single line comments

      const lines = cleanContent.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let match: any;
        // Reset regex state since it's global
        relativeImportRegex.lastIndex = 0;

        while ((match = relativeImportRegex.exec(line)) !== null) {
          const importPath = match[1] || match[2] || match[3];
          if (
            importPath.endsWith(".css") ||
            importPath.endsWith(".scss") ||
            importPath.endsWith(".sass")
          ) {
            continue;
          }
          const relativeFilePath = path.relative(projectRoot, file);
          violations.push(`${relativeFilePath}:${i + 1} -> "${importPath}"`);
        }
      }
    }

    if (violations.length > 0) {
      console.error(`\n[FAIL] Found ${violations.length} relative import violations:`);
      violations.forEach((v) => console.error(`  ${v}`));
    }

    expect(violations).toEqual([]);
  });
});
