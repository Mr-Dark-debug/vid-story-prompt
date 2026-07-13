import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const VERSION = "v1";
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
    VERSION,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptSecret(envelope: string, keyMaterial: string) {
  if (envelope.startsWith(`${VERSION}.`)) {
    const parts = envelope.split(".");
    if (parts.length !== 4) throw new Error("The encrypted token envelope is invalid.");
    const [, ivValue, tagValue, encryptedValue] = parts;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      keyFrom(keyMaterial),
      Buffer.from(ivValue, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  }

  // Compatibility with the original iv + tag + ciphertext envelope.
  const legacy = Buffer.from(envelope, "base64url");
  if (legacy.length <= IV_BYTES + TAG_BYTES) throw new Error("The encrypted token is invalid.");
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

export function secureTextEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function safeReturnPath(value: string | undefined, fallback = "/app/settings/integrations") {
  return value?.startsWith("/") && !value.startsWith("//") && !value.includes("\\")
    ? value
    : fallback;
}
