import { describe, it, expect, beforeEach } from "vitest";
import { createCipheriv } from "crypto";
import { encrypt, decrypt, isEncrypted } from "./crypto";

const KEY_64HEX = "0a".repeat(32);

beforeEach(() => {
  process.env.ENCRYPTION_KEY = KEY_64HEX;
});

describe("crypto (AES-256-GCM)", () => {
  it("round-trip enkripcija/deskripcija", () => {
    const secret = "ghp_dummy_1234567890";
    const cipher = encrypt(secret);
    expect(decrypt(cipher)).toBe(secret);
  });

  it("radi sa unicode stringovima", () => {
    const secret = "token-šifra-emoji-🚀-čćžšđ";
    expect(decrypt(encrypt(secret))).toBe(secret);
  });

  it("generiše novi IV svaki put (ciphertexti se razlikuju)", () => {
    const a = encrypt("same");
    const b = encrypt("same");
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe(decrypt(b));
  });

  it("format je iv:authTag:encrypted (3 base64 dijela)", () => {
    const cipher = encrypt("x");
    const parts = cipher.split(":");
    expect(parts).toHaveLength(3);
    for (const p of parts) {
      expect(Buffer.from(p, "base64").length).toBeGreaterThan(0);
    }
  });

  it("isEncrypted prepoznaje ispravan ciphertext", () => {
    expect(isEncrypted(encrypt("x"))).toBe(true);
    expect(isEncrypted("plain-text")).toBe(false);
    expect(isEncrypted("a:b")).toBe(false);
    expect(isEncrypted("")).toBe(false);
  });

  it("odbija malformed ciphertext", () => {
    expect(() => decrypt("samo-jedan-dio")).toThrow();
    expect(() => decrypt("a:b")).toThrow();
  });

  it("odbija tamperovan ciphertext (auth tag ne prolazi)", () => {
    const cipher = encrypt("važan podatak");
    const parts = cipher.split(":");
    const tampered = parts[0] + ":" + parts[1] + ":" + Buffer.from("AAAA").toString("base64");
    expect(() => decrypt(tampered)).toThrow();
  });

  it("baca grešku kada ENCRYPTION_KEY nedostaje", () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => encrypt("x")).toThrow(/ENCRYPTION_KEY/);
  });

  it("ne baca 'Invalid key length' sa proizvoljnim ENCRYPTION_KEY (fix proizvodnje)", () => {
    process.env.ENCRYPTION_KEY = "straxor-prod-secret-not-valid-base64-32b";
    const secret = "sk-or-v1-abcdef1234567890ABCDEF1234567890";
    const cipher = encrypt(secret);
    expect(decrypt(cipher)).toBe(secret);
  });

  it("radi sa kratkim/plain ENCRYPTION_KEY (SHA-256 derivacija)", () => {
    process.env.ENCRYPTION_KEY = "kratki-kljuc";
    const secret = "token-123";
    expect(decrypt(encrypt(secret))).toBe(secret);
  });

  it("decrypt fallback čita legacy base64 (32B) šifrovane vrijednosti", () => {
    const legacySeed = Buffer.alloc(32, 7).toString("base64");
    process.env.ENCRYPTION_KEY = legacySeed;

    // Simulate a row encrypted under the OLD derivation (naive base64 decode).
    const legacyKey = Buffer.from(legacySeed, "base64");
    const iv = Buffer.alloc(16, 3);
    const cipher = createCipheriv("aes-256-gcm", legacyKey, iv);
    const enc = Buffer.concat([cipher.update("legacy-secret", "utf8"), cipher.final()]);
    const ciphertext = `${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${enc.toString("base64")}`;

    // New derivation = sha256(seed) ≠ legacyKey, so decrypt must fall back.
    expect(decrypt(ciphertext)).toBe("legacy-secret");
  });
});
