/**
 * @file scripts/generate-ssl.ts
 * @description Automatic SSL/TLS self-signed certificate generator for SG Forge Edge Reverse Proxy.
 * Ensures localhost development certificates exist in volume/ssl/ for secure port 443 HTTPS routing.
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const SSL_DIR = path.resolve(process.cwd(), "volume/ssl");
const KEY_PATH = path.join(SSL_DIR, "server.key");
const CERT_PATH = path.join(SSL_DIR, "server.crt");

/**
 * Checks if SSL certificate and private key exist, or generates new self-signed credentials.
 * @returns Object containing filepaths to the generated or existing key and cert.
 */
export function ensureSslCertificates(): { keyPath: string; certPath: string } {
  if (!fs.existsSync(SSL_DIR)) {
    fs.mkdirSync(SSL_DIR, { recursive: true });
  }

  if (fs.existsSync(KEY_PATH) && fs.existsSync(CERT_PATH)) {
    return { keyPath: KEY_PATH, certPath: CERT_PATH };
  }

  console.log(
    "[SSL Generator] Generating self-signed SSL/TLS certificate for localhost (Port 443)...",
  );
  try {
    const cmd = `openssl req -x509 -newkey rsa:2048 -keyout "${KEY_PATH}" -out "${CERT_PATH}" -days 365 -nodes -subj "/CN=localhost/O=SG Forge/OU=Dev Gateway"`;
    execSync(cmd, { stdio: "pipe" });
    console.log("[SSL Generator] SSL certificates successfully created in volume/ssl/");
  } catch (err: any) {
    console.warn(
      "[SSL Generator] OpenSSL generation failed. HTTPS port 443 will run in HTTP-only fallback mode if needed.",
      err.message,
    );
  }

  return { keyPath: KEY_PATH, certPath: CERT_PATH };
}

// Auto-run if executed directly
if (import.meta.main) {
  ensureSslCertificates();
}
