import * as fs from "fs";
import * as path from "path";

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const TARGET_DIRS = ["core/src", "sandbox/apps", "packages/sdk", "test"];

function getFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = entries.flatMap((entry) => {
    const res = path.resolve(dir, entry.name); // nosemgrep
    if (entry.isDirectory()) {
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

function checkImports() {
  const files: string[] = [];
  for (const dirName of TARGET_DIRS) {
    const dirPath = path.resolve(PROJECT_ROOT, dirName);
    files.push(...getFiles(dirPath));
  }

  const targetFiles = files.filter((file) => {
    const isCodeFile =
      file.endsWith(".ts") ||
      file.endsWith(".tsx") ||
      file.endsWith(".js") ||
      file.endsWith(".jsx");
    const isDts = file.endsWith(".d.ts");
    const isSelf = file === __filename;
    const isBundledAsset = file.endsWith("dev-dashboard/dashboard.js");
    return isCodeFile && !isDts && !isSelf && !isBundledAsset;
  });

  const relativeImportRegex =
    /(?:import|export)\s+(?:(?:\*|[\w\s{},]*)\s+from\s+)?['"](\.\.?\/[^'"]*)['"]|import\(['"](\.\.?\/[^'"]*)['"]\)|require\(['"](\.\.?\/[^'"]*)['"]\)/g;
  const violations: string[] = [];

  for (const file of targetFiles) {
    const content = fs.readFileSync(file, "utf8");
    const cleanContent = content
      .replace(/\/\*[\s\S]*?\*\//g, "") // Block comments
      .replace(/\/\/.*/g, ""); // Single line comments

    const lines = cleanContent.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let match;
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
        const relativeFilePath = path.relative(PROJECT_ROOT, file);
        violations.push(`${relativeFilePath}:${i + 1} -> "${importPath}"`);
      }
    }
  }

  if (violations.length > 0) {
    console.error(`\n[FAIL] Found ${violations.length} relative import violations:`);
    violations.forEach((v) => console.error(`  ${v}`));
    process.exit(1);
  } else {
    console.log("✅ No relative import violations found.");
    process.exit(0);
  }
}

checkImports();
