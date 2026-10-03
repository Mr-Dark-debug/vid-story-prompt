// AES-256-GCM envelope encryption for stored AI provider keys, built on Web Crypto so the same
// code runs on the Vercel function, the Worker fallback and the Node video worker.
//
// Envelope: `aik1.<keyVersion>.<iv>.<ciphertext+tag>` (base64url). Keys are derived with HKDF from
// the configured secret per version. The associated data binds a ciphertext to its owner
// (workspace, user, provider), so a ciphertext copied onto another row fails to decrypt.

const ENVELOPE_PREFIX = "aik1";
const VERSION_PATTERN = /^[A-Za-z0-9_-]{1,16}$/;
const SALT = new TextEncoder().encode("vidrial-ai-credential-salt-v1");
const MIN_KEY_MATERIAL = 32;

export type CredentialKeyRing = {
  current: { version: string; material: string };
  previous: Readonly<Record<string, string>>;
};

export type CredentialKeyEnv = {
  AI_CREDENTIAL_ENCRYPTION_KEY?: string;
  AI_CREDENTIAL_ENCRYPTION_KEY_VERSION?: string;
  /** `version:material` pairs separated by commas; kept so old rows stay readable during rotation. */
  AI_CREDENTIAL_ENCRYPTION_KEYS_PREVIOUS?: string;
};

export type CredentialAad = { workspaceId: string; userId: string; providerId: string };

export class CredentialCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CredentialCryptoError";
  }
}

export function parseCredentialKeyRing(env: CredentialKeyEnv): CredentialKeyRing {
  const material = env.AI_CREDENTIAL_ENCRYPTION_KEY;
  if (!material || material.length < MIN_KEY_MATERIAL) {
    throw new CredentialCryptoError(
      `AI_CREDENTIAL_ENCRYPTION_KEY must be set to at least ${MIN_KEY_MATERIAL} characters.`,
    );
  }
  const version = env.AI_CREDENTIAL_ENCRYPTION_KEY_VERSION?.trim() || "1";
  if (!VERSION_PATTERN.test(version)) {
    throw new CredentialCryptoError(
      "AI_CREDENTIAL_ENCRYPTION_KEY_VERSION is not a valid version label.",
    );
  }
  const previous: Record<string, string> = {};
  for (const entry of (env.AI_CREDENTIAL_ENCRYPTION_KEYS_PREVIOUS ?? "").split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const separator = trimmed.indexOf(":");
    const label = trimmed.slice(0, separator);
    const value = trimmed.slice(separator + 1);
    if (separator < 1 || !VERSION_PATTERN.test(label) || value.length < MIN_KEY_MATERIAL) {
      throw new CredentialCryptoError("AI_CREDENTIAL_ENCRYPTION_KEYS_PREVIOUS is malformed.");
    }
    if (label === version) {
      throw new CredentialCryptoError("A previous key reuses the current key version label.");
    }
    previous[label] = value;
  }
  return { current: { version, material }, previous };
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function deriveKey(material: string, version: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const base = await crypto.subtle.importKey("raw", encoder.encode(material), "HKDF", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: SALT, info: encoder.encode(`aes-256-gcm:${version}`) },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function additionalData(aad: CredentialAad): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(`${aad.workspaceId}|${aad.userId}|${aad.providerId}`);
}

export async function encryptCredential(
  plaintext: string,
  aad: CredentialAad,
  ring: CredentialKeyRing,
): Promise<{ envelope: string; keyVersion: string }> {
  const { version, material } = ring.current;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(material, version);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: additionalData(aad) },
    key,
    new TextEncoder().encode(plaintext),
  );
  return {
    envelope: [
      ENVELOPE_PREFIX,
      version,
      toBase64Url(iv),
      toBase64Url(new Uint8Array(encrypted)),
    ].join("."),
    keyVersion: version,
  };
}

function parseEnvelope(envelope: string) {
  const parts = envelope.split(".");
  if (parts.length !== 4 || parts[0] !== ENVELOPE_PREFIX || !VERSION_PATTERN.test(parts[1])) {
    throw new CredentialCryptoError("The stored credential is not in a recognised format.");
  }
  return { version: parts[1], iv: parts[2], ciphertext: parts[3] };
}

export function envelopeKeyVersion(envelope: string): string {
  return parseEnvelope(envelope).version;
}

export async function decryptCredential(
  envelope: string,
  aad: CredentialAad,
  ring: CredentialKeyRing,
): Promise<string> {
  const parsed = parseEnvelope(envelope);
  const material =
    parsed.version === ring.current.version ? ring.current.material : ring.previous[parsed.version];
  if (!material) {
    throw new CredentialCryptoError(
      "The key that encrypted this credential is no longer configured.",
    );
  }
  try {
    const key = await deriveKey(material, parsed.version);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64Url(parsed.iv), additionalData: additionalData(aad) },
      key,
      fromBase64Url(parsed.ciphertext),
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    // Deliberately uninformative: wrong key, wrong owner and tampering look the same.
    throw new CredentialCryptoError("The stored credential could not be decrypted.");
  }
}

export function needsRotation(envelope: string, ring: CredentialKeyRing): boolean {
  return envelopeKeyVersion(envelope) !== ring.current.version;
}

/** Re-encrypts an envelope under the current key version. */
export async function rotateCredential(
  envelope: string,
  aad: CredentialAad,
  ring: CredentialKeyRing,
) {
  const plaintext = await decryptCredential(envelope, aad, ring);
  return encryptCredential(plaintext, aad, ring);
}

/** The only fragment of a key that may be stored or shown. */
export function keyLast4(apiKey: string): string {
  return apiKey.trim().slice(-4);
}
