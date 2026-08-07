import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { env } from "./env";

// AES-256-GCM for stored provider credentials. Key comes from CREDENTIAL_ENCRYPTION_KEY.
function getKey(): Buffer {
  if (!env.CREDENTIAL_ENCRYPTION_KEY) {
    // Derived fallback for local dev only; production must set a real key.
    return createHash("sha256").update(`dev:${env.AUTH_SECRET}`).digest();
  }
  return Buffer.from(env.CREDENTIAL_ENCRYPTION_KEY, "hex");
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}

/** Masks a credential to a display hint, e.g. "pat-****3f2a". Never store or return the full value. */
export function credentialHint(value: string): string {
  if (value.length <= 4) return "****";
  return `${value.slice(0, 3)}****${value.slice(-4)}`;
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
