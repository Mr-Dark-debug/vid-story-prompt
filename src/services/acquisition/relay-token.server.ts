import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { createServerOnlyFn } from "@tanstack/react-start";
import { z } from "zod";

const capabilityClaims = z.object({
  version: z.literal(1),
  jobId: z.string().uuid(),
  videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
  expectedDurationSeconds: z.number().positive(),
  sourceSection: z
    .object({ startSeconds: z.number().nonnegative(), endSeconds: z.number().positive() })
    .nullable(),
  uploadPath: z.string().min(20).max(1024),
  maximumBytes: z.number().int().positive(),
  expiresAt: z.string().datetime(),
  nonce: z.string().uuid(),
});

export type RelayCapabilityClaims = z.infer<typeof capabilityClaims>;

export const createRelayPairingCode = createServerOnlyFn(() =>
  randomBytes(5).toString("hex").toUpperCase(),
);
export const createRelayPairingChallenge = createServerOnlyFn(() =>
  randomBytes(32).toString("base64url"),
);
export const createRelayDeviceCredential = createServerOnlyFn(() =>
  randomBytes(32).toString("base64url"),
);
export const createRelayNonce = createServerOnlyFn(() => randomUUID());

function encode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

export const hashRelaySecret = createServerOnlyFn((value: string) => {
  return createHash("sha256").update(value).digest("hex");
});

export const signRelayCapability = createServerOnlyFn(
  (claims: RelayCapabilityClaims, key: string) => {
    if (key.length < 32) throw new Error("Relay signing key is not configured securely.");
    const payload = encode(JSON.stringify(capabilityClaims.parse(claims)));
    const signature = createHmac("sha256", key).update(payload).digest("base64url");
    return `${payload}.${signature}`;
  },
);

export const verifyRelayCapability = createServerOnlyFn(
  (token: string, key: string, now = Date.now()) => {
    const [payload, provided, extra] = token.split(".");
    if (!payload || !provided || extra) throw new Error("Invalid relay capability.");
    const expected = createHmac("sha256", key).update(payload).digest();
    let actual: Buffer;
    try {
      actual = Buffer.from(provided, "base64url");
    } catch {
      throw new Error("Invalid relay capability.");
    }
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new Error("Invalid relay capability.");
    }
    const claims = capabilityClaims.parse(JSON.parse(decode(payload)));
    if (Date.parse(claims.expiresAt) <= now) throw new Error("Relay capability expired.");
    return claims;
  },
);
