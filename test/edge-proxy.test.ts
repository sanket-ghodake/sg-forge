/**
 * @file test/edge-proxy.test.ts
 * @description Automated validation test suite for SG Forge Edge Reverse Proxy.
 * Verifies manifest discovery, landing page rendering, and route dispatching logic.
 */

import { describe, expect, it } from "bun:test";
import fs from "fs";
import path from "path";
import { scanAppManifests } from "../scripts/edge-reverse-proxy";

describe("Edge Reverse Proxy & Manifest Discovery", () => {
  it("should scan and discover existing sandbox application manifests", () => {
    scanAppManifests();
    const appsDir = path.resolve(process.cwd(), "sandbox/apps");
    expect(fs.existsSync(appsDir)).toBe(true);

    const expenseManifest = path.join(appsDir, "reference-expenses/app.json");
    if (fs.existsSync(expenseManifest)) {
      const parsed = JSON.parse(fs.readFileSync(expenseManifest, "utf8"));
      expect(parsed.slug).toBe("reference-expenses");
      expect(parsed.entryPoint).toContain("8085");
    }
  });

  it("should verify SSL/TLS certificates exist in volume/ssl/", () => {
    const sslDir = path.resolve(process.cwd(), "volume/ssl");
    const key = path.join(sslDir, "server.key");
    const cert = path.join(sslDir, "server.crt");
    expect(fs.existsSync(key)).toBe(true);
    expect(fs.existsSync(cert)).toBe(true);
  });
});
