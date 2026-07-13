import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const IV_BYTES = 12;
const TAG_BYTES = 16;

function keyFrom(material: string) {
  return createHash("sha256").update(material).digest();
}

export function encryptSecret(value: string, keyMaterial: string) {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", keyFrom(keyMaterial), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptSecret(envelope: string, keyMaterial: string) {
  if (envelope.startsWith("v1.")) {
    const parts = envelope.split(".");
    if (parts.length !== 4) throw new Error("Invalid encrypted token envelope");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      keyFrom(keyMaterial),
      Buffer.from(parts[1], "base64url"),
    );
    decipher.setAuthTag(Buffer.from(parts[2], "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(parts[3], "base64url")),
      decipher.final(),
    ]).toString("utf8");
  }
  const legacy = Buffer.from(envelope, "base64url");
  if (legacy.length <= IV_BYTES + TAG_BYTES) throw new Error("Invalid encrypted token");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    keyFrom(keyMaterial),
    legacy.subarray(0, IV_BYTES),
  );
  decipher.setAuthTag(legacy.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
  return Buffer.concat([
    decipher.update(legacy.subarray(IV_BYTES + TAG_BYTES)),
    decipher.final(),
  ]).toString("utf8");
}
