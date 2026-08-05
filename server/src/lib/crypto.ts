import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function isHex64(s: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(s);
}

// Always returns a valid 32-byte AES-256 key:
//  - a 64-char hex seed → raw 32 bytes (original behaviour)
//  - anything else      → SHA-256 digest of the seed (deterministic 32 bytes).
// This guarantees createCipheriv/createDecipheriv never throw
// "RangeError: Invalid key length", regardless of how ENCRYPTION_KEY is set
// (the cause of "Invalid key length" 500s when saving API keys in production).
function deriveKey(seed: string): Buffer {
  if (isHex64(seed)) {
    return Buffer.from(seed, "hex");
  }
  return createHash("sha256").update(seed, "utf8").digest();
}

// Legacy derivation used by older deploys: naive base64 decode (any length).
// Kept only as a decrypt fallback so rows encrypted under a valid 32-byte
// base64 key remain readable after the derivation change.
function legacyBase64Key(seed: string): Buffer {
  return Buffer.from(seed, "base64");
}

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable is required");
  }
  return deriveKey(key);
}

function decryptWithKey(ciphertext: string, key: Buffer): string {
  const parts = ciphertext.split(":");

  if (parts.length !== 3) {
    throw new Error("Invalid ciphertext format");
  }

  const iv = Buffer.from(parts[0], "base64");
  const authTag = Buffer.from(parts[1], "base64");
  const encrypted = Buffer.from(parts[2], "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted (all base64)
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decrypt(ciphertext: string): string {
  const primary = getEncryptionKey();
  const attempts: Buffer[] = [primary];
  const seed = process.env.ENCRYPTION_KEY;
  if (seed) {
    const legacy = legacyBase64Key(seed);
    if (!legacy.equals(primary)) attempts.push(legacy);
  }

  let lastError: unknown;
  for (const key of attempts) {
    try {
      return decryptWithKey(ciphertext, key);
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : "";
      const isRange = err instanceof RangeError;
      const invalidKeyLength = msg === "Invalid key length";
      const authFailed = /Unsupported state or unable to authenticate data|unable to authenticate|bad decrypt|Bad decrypt|wrong final block/i.test(msg);
      // Only try the next key on length/auth failures; any other error (e.g.
      // malformed ciphertext) should propagate immediately.
      if (!isRange && !invalidKeyLength && !authFailed) throw err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Decryption failed");
}

export function isEncrypted(value: string): boolean {
  const parts = value.split(":");
  return parts.length === 3;
}
