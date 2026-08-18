import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getEncryptionKey(): Buffer {
  const secret =
    process.env.JWT_SECRET || "fallback-super-secret-key-that-is-at-least-32-characters-long";
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptText(text: string): string {
  if (!text) return text;
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decryptText(encryptedText: string): string {
  if (!encryptedText) return encryptedText;
  try {
    const parts = encryptedText.split(":");
    if (parts.length !== 3) {
      return encryptedText;
    }
    const [ivHex, authTagHex, encryptedHex] = parts;
    if (ivHex.length !== IV_LENGTH * 2 || authTagHex.length !== 32) {
      return encryptedText;
    }
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: 16 });
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (e) {
    return encryptedText;
  }
}
