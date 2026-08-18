// scripts/dynamic-app-runner.ts
import { type ChildProcess, spawn } from "child_process";
import fs from "fs";
import path from "path";

const isDev = process.env.NODE_ENV === "development";

if (process.env.RUNNING_IN_DOCKER === "true") {
  console.log(
    "[App Runner] Running in Docker mode. Microservices are managed as separate Docker containers. Native runner disabled.",
  );
  process.exit(0);
}

const appsDir = path.resolve(process.cwd(), "sandbox/apps");

const activeProcesses: { slug: string; process: ChildProcess }[] = [];

// Clean up all spawned app processes on exit
function cleanup() {
  console.log("\n[App Runner] Stopping all background microservices...");
  for (const { slug, process } of activeProcesses) {
    try {
      console.log(`[App Runner] Killing process for ${slug} (PID: ${process.pid})`);
      process.kill("SIGTERM");
    } catch (err) {
      // ignore
    }
  }
}

process.on("SIGINT", () => {
  cleanup();
  process.exit(0);
});

process.on("SIGTERM", () => {
  cleanup();
  process.exit(0);
});

process.on("exit", () => {
  cleanup();
});

// Map of known microservices to their database roles and passwords
const appRoleMap: Record<string, { user: string; pass: string }> = {
  "reference-expenses": { user: "app_reference_expenses", pass: "change_me_expenses_password" },
  "reference-go": { user: "app_reference_go", pass: "change_me_go_password" },
  "reference-python": { user: "app_reference_python", pass: "change_me_python_password" },
};

function getAppDatabaseUrl(slug: string, baseDbUrl: string | undefined): string | undefined {
  if (!baseDbUrl) return undefined;
  const roleInfo = appRoleMap[slug];
  if (!roleInfo) return baseDbUrl;

  try {
    const urlPattern = /^(postgres(?:ql)?:\/\/)([^:]+):([^@]+)(@.+)$/;
    const match = baseDbUrl.match(urlPattern);
    if (match) {
      const [, protocol, oldUser, oldPass, rest] = match;
      return `${protocol}${roleInfo.user}:${roleInfo.pass}${rest}`;
    }
  } catch (e) {
    // ignore
  }
  return baseDbUrl;
}

// Run a command
function startAppServer(
  slug: string,
  cmd: string,
  args: string[],
  cwd: string,
  clientId?: string,
  clientSecret?: string,
) {
  console.log(`[App Runner] Starting server for "${slug}" in ${cwd} via: ${cmd} ${args.join(" ")}`);

  const appDbUrl = getAppDatabaseUrl(slug, process.env.DATABASE_URL);
  const proc = spawn(cmd, args, {
    cwd,
    shell: true,
    env: {
      ...process.env,
      PORTAL_URL: process.env.PORTAL_URL || "http://localhost:3001",
      ...(appDbUrl ? { DATABASE_URL: appDbUrl } : {}),
      ...(clientId ? { CLIENT_ID: clientId } : {}),
      ...(clientSecret ? { CLIENT_SECRET: clientSecret } : {}),
    },
  });

  const logFile = path.join(cwd, "app.log");
  // Clear file first or open in write mode
  fs.writeFileSync(logFile, "");
  const logStream = fs.createWriteStream(logFile, { flags: "a" });

  proc.stdout?.on("data", (data) => {
    const lines = data.toString().trim().split("\n");
    for (const line of lines) {
      if (line) {
        console.log(`[App: ${slug}] ${line}`);
        logStream.write(`${new Date().toISOString()} [INFO] ${line}\n`);
      }
    }
  });

  proc.stderr?.on("data", (data) => {
    const lines = data.toString().trim().split("\n");
    for (const line of lines) {
      if (line) {
        console.error(`[App: ${slug}] [ERROR] ${line}`);
        logStream.write(`${new Date().toISOString()} [ERROR] ${line}\n`);
      }
    }
  });

  proc.on("close", (code) => {
    console.log(`[App Runner] App "${slug}" exited with code ${code}`);
  });

  activeProcesses.push({ slug, process: proc });
}

function startAppByPath(appPath: string) {
  if (!fs.existsSync(appPath) || !fs.statSync(appPath).isDirectory()) return;

  const manifestPath = path.join(appPath, "app.json");
  if (!fs.existsSync(manifestPath)) return;

  let manifest: any = {};
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (e) {
    console.error(`[App Runner] Failed to parse app.json in ${path.basename(appPath)}`);
    return;
  }

  const slug = manifest.slug || path.basename(appPath);

  // Avoid launching duplicate processes for the same app slug
  const alreadyRunning = activeProcesses.some((p) => p.slug === slug);
  if (alreadyRunning) return;

  // Extract client credentials if declared
  const clientId = manifest.clientId;
  const clientSecret = manifest.clientSecret;

  // Check if manifest has custom run/dev command
  const customCommand = isDev ? manifest.devCommand || manifest.runCommand : manifest.runCommand;

  if (customCommand) {
    const parts = customCommand.split(" ");
    const cmd = parts[0];
    const args = parts.slice(1);
    startAppServer(slug, cmd, args, appPath, clientId, clientSecret);
    return;
  }

  // Auto-detect files
  if (fs.existsSync(path.join(appPath, "server.ts"))) {
    if (isDev) {
      startAppServer(slug, "bun", ["--watch", "server.ts"], appPath, clientId, clientSecret);
    } else {
      startAppServer(slug, "bun", ["server.ts"], appPath, clientId, clientSecret);
    }
  } else if (fs.existsSync(path.join(appPath, "server.js"))) {
    startAppServer(slug, "node", ["server.js"], appPath, clientId, clientSecret);
  } else if (fs.existsSync(path.join(appPath, "server.py"))) {
    startAppServer(slug, "python3", ["server.py"], appPath, clientId, clientSecret);
  } else if (fs.existsSync(path.join(appPath, "main.py"))) {
    startAppServer(slug, "python3", ["main.py"], appPath, clientId, clientSecret);
  } else if (fs.existsSync(path.join(appPath, "main.go"))) {
    // In production inside docker, check if precompiled binary exists
    const prodBin = path.join(appPath, `${slug}-bin`);
    if (!isDev && fs.existsSync(prodBin)) {
      startAppServer(slug, prodBin, [], appPath, clientId, clientSecret);
    } else {
      startAppServer(slug, "go", ["run", "main.go"], appPath, clientId, clientSecret);
    }
  }
}

function scanAndStartApps() {
  if (!fs.existsSync(appsDir)) {
    console.warn(`[App Runner] Apps directory not found: ${appsDir}`);
    return;
  }

  const items = fs.readdirSync(appsDir);
  for (const item of items) {
    try {
      startAppByPath(path.join(appsDir, item));
    } catch (err) {
      console.error(`[App Runner] Error loading app ${item}:`, err);
    }
  }
}

console.log("[App Runner] Scanning and initiating dynamic sandboxed application servers...");
scanAndStartApps();

// Watch appsDir for newly added folders/apps at runtime
if (fs.existsSync(appsDir)) {
  console.log(`[App Runner] Watching directory for runtime integrations: ${appsDir}`);
  fs.watch(appsDir, { recursive: false }, (eventType, filename) => {
    if (filename) {
      const appPath = path.join(appsDir, filename);
      // Debounce and delay slightly to allow files (like app.json) to be written
      setTimeout(() => {
        try {
          if (fs.existsSync(appPath) && fs.statSync(appPath).isDirectory()) {
            startAppByPath(appPath);
          }
        } catch (e) {
          // ignore transient filesystem checks
        }
      }, 500);
    }
  });
}

// Keep process alive
setInterval(() => {}, 1000);
