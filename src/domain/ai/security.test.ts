import { describe, expect, it } from "vitest";
import { createAdapterMatrix } from "./adapter-matrix";
import {
  CredentialCryptoError,
  decryptCredential,
  encryptCredential,
  envelopeKeyVersion,
  keyLast4,
  needsRotation,
  parseCredentialKeyRing,
  rotateCredential,
} from "./credential-crypto";
import {
  AiProviderError,
  classifyHttpFailure,
  parseRetryAfter,
  redactSecrets,
  userMessageForAiError,
} from "./errors";
import { collect, jsonResponse, mockFetch } from "./test-helpers";

const KEY_A = "sk-test-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

describe("secret redaction", () => {
  it("removes exact keys and key-shaped strings", () => {
    const text = `bad key ${KEY_A}; Bearer abc.def-123; AIzaSyD1234567890123456789012; sk-ant-xyz12345678`;
    const cleaned = redactSecrets(text, [KEY_A]);
    expect(cleaned).not.toContain(KEY_A);
    expect(cleaned).not.toMatch(/abc\.def-123|AIzaSy|sk-ant-xyz/);
  });

  it("scrubs a key echoed by the provider from every adapter error path", async () => {
    // Real providers sometimes echo (part of) the offending key in their error body.
    for (const [providerId, key] of Object.entries(createAdapterMatrix())) {
      const echoed = jsonResponse(
        {
          error: {
            message: `Incorrect API key provided: ${key.secret}. Visit https://example.test`,
          },
        },
        { status: 401 },
      );
      const { fetcher } = mockFetch([
        echoed.clone(),
        echoed.clone(),
        echoed.clone(),
        echoed.clone(),
      ]);
      const adapter = key.make(fetcher);
      const attempts: Array<() => Promise<unknown>> = [
        () => adapter.listModels(key.secret),
        () =>
          adapter.completeJson({
            apiKey: key.secret,
            modelId: "m",
            messages: [{ role: "user", content: "hi" }],
            schemaName: "s",
            schema: { type: "object" },
          }),
        () =>
          collect(
            adapter.streamChat({
              apiKey: key.secret,
              modelId: "m",
              messages: [{ role: "user", content: "hi" }],
            }),
          ),
      ];
      for (const attempt of attempts) {
        const error = await attempt().catch((caught: unknown) => caught);
        expect(error, providerId).toBeInstanceOf(AiProviderError);
        const serialized = JSON.stringify({
          message: (error as Error).message,
          stack: (error as Error).stack,
          own: Object.fromEntries(Object.entries(error as object)),
        });
        expect(serialized, providerId).not.toContain(key.secret);
        expect(serialized, providerId).not.toContain("Bearer");
        expect((error as AiProviderError).code).toBe("invalid_key");
        expect((error as AiProviderError).invalidatesCredential).toBe(true);
      }
    }
  });

  it("never carries the key through network failures", async () => {
    for (const [providerId, key] of Object.entries(createAdapterMatrix())) {
      const fetcher = (async () => {
        throw new TypeError(`fetch failed for header x-api-key: ${key.secret}`);
      }) as typeof fetch;
      const error = await key
        .make(fetcher)
        .listModels(key.secret)
        .catch((caught: unknown) => caught);
      expect(error, providerId).toMatchObject({ code: "network", retryable: true });
      expect(JSON.stringify([(error as Error).message, (error as Error).stack])).not.toContain(
        key.secret,
      );
      expect((error as { cause?: unknown }).cause).toBeUndefined();
    }
  });
});

describe("error classification", () => {
  const base = { providerId: "openai", providerLabel: "OpenAI", secrets: [], retryAfter: null };
  const classify = (status: number, body: unknown, retryAfter: string | null = null) =>
    classifyHttpFailure({ ...base, status, body: JSON.stringify(body), retryAfter });

  it("marks only credential failures as credential-invalidating", () => {
    expect(classify(401, {}).invalidatesCredential).toBe(true);
    expect(classify(403, {}).invalidatesCredential).toBe(true);
    for (const status of [400, 404, 429, 500, 503]) {
      expect(classify(status, {}).invalidatesCredential).toBe(false);
    }
  });

  it("retries rate limits and server errors, never client faults", () => {
    expect(classify(429, {}, "5")).toMatchObject({
      code: "rate_limited",
      retryable: true,
      retryAfterSeconds: 5,
    });
    expect(classify(529, {})).toMatchObject({ code: "provider_unavailable", retryable: true });
    expect(
      classify(400, { error: { message: "prompt is too long: 250000 tokens" } }),
    ).toMatchObject({
      code: "context_length",
      retryable: false,
    });
    expect(
      classify(400, { error: { message: "Request blocked by safety settings" } }),
    ).toMatchObject({
      code: "content_filtered",
      retryable: false,
    });
    expect(classify(402, {})).toMatchObject({ code: "quota_exceeded", retryable: false });
    expect(classify(400, { error: { message: "bad field" } })).toMatchObject({
      code: "bad_request",
      retryable: false,
    });
  });

  it("parses Retry-After seconds and HTTP dates, bounded", () => {
    expect(parseRetryAfter("30")).toBe(30);
    expect(parseRetryAfter("999999")).toBe(3_600);
    expect(
      parseRetryAfter(new Date(Date.now() + 20_000).toUTCString(), Date.now()),
    ).toBeGreaterThanOrEqual(19);
    expect(parseRetryAfter("soon")).toBeNull();
    expect(parseRetryAfter(null)).toBeNull();
  });

  it("gives user copy that never includes provider-supplied text", () => {
    const text = userMessageForAiError("invalid_key", "Anthropic");
    expect(text).toMatch(/Reconnect/);
  });
});

describe("credential encryption", () => {
  const env = {
    AI_CREDENTIAL_ENCRYPTION_KEY: "k".repeat(40),
    AI_CREDENTIAL_ENCRYPTION_KEY_VERSION: "1",
  };
  const ring = parseCredentialKeyRing(env);
  const aad = { workspaceId: "w-1", userId: "u-1", providerId: "anthropic" };

  it("round-trips without exposing the plaintext in the envelope", async () => {
    const { envelope, keyVersion } = await encryptCredential(KEY_A, aad, ring);
    expect(keyVersion).toBe("1");
    expect(envelope).not.toContain(KEY_A);
    expect(envelope).not.toContain(btoa(KEY_A).slice(0, 12));
    expect(await decryptCredential(envelope, aad, ring)).toBe(KEY_A);
  });

  it("uses a fresh IV per encryption", async () => {
    const [a, b] = await Promise.all([
      encryptCredential(KEY_A, aad, ring),
      encryptCredential(KEY_A, aad, ring),
    ]);
    expect(a.envelope).not.toBe(b.envelope);
  });

  it("refuses a ciphertext moved to another owner, provider or tampered bytes", async () => {
    const { envelope } = await encryptCredential(KEY_A, aad, ring);
    for (const wrong of [
      { ...aad, userId: "u-2" },
      { ...aad, workspaceId: "w-2" },
      { ...aad, providerId: "openai" },
    ]) {
      await expect(decryptCredential(envelope, wrong, ring)).rejects.toBeInstanceOf(
        CredentialCryptoError,
      );
    }
    const parts = envelope.split(".");
    parts[3] = `${parts[3].slice(0, -2)}${parts[3].endsWith("AA") ? "BB" : "AA"}`;
    await expect(decryptCredential(parts.join("."), aad, ring)).rejects.toThrow(
      /could not be decrypted/,
    );
    await expect(decryptCredential("garbage", aad, ring)).rejects.toThrow(
      /not in a recognised format/,
    );
  });

  it("rotates to a new key version while old rows stay readable", async () => {
    const old = await encryptCredential(KEY_A, aad, ring);
    const rotatedRing = parseCredentialKeyRing({
      AI_CREDENTIAL_ENCRYPTION_KEY: "n".repeat(40),
      AI_CREDENTIAL_ENCRYPTION_KEY_VERSION: "2",
      AI_CREDENTIAL_ENCRYPTION_KEYS_PREVIOUS: `1:${"k".repeat(40)}`,
    });
    expect(needsRotation(old.envelope, rotatedRing)).toBe(true);
    expect(await decryptCredential(old.envelope, aad, rotatedRing)).toBe(KEY_A);

    const fresh = await rotateCredential(old.envelope, aad, rotatedRing);
    expect(fresh.keyVersion).toBe("2");
    expect(envelopeKeyVersion(fresh.envelope)).toBe("2");
    expect(needsRotation(fresh.envelope, rotatedRing)).toBe(false);
    expect(await decryptCredential(fresh.envelope, aad, rotatedRing)).toBe(KEY_A);

    // Once the previous key is dropped, an un-rotated row is unrecoverable and says so.
    await expect(
      decryptCredential(
        old.envelope,
        aad,
        parseCredentialKeyRing({
          ...env,
          AI_CREDENTIAL_ENCRYPTION_KEY: "n".repeat(40),
          AI_CREDENTIAL_ENCRYPTION_KEY_VERSION: "2",
        }),
      ),
    ).rejects.toThrow(/no longer configured/);
  });

  it("validates key configuration", () => {
    expect(() => parseCredentialKeyRing({})).toThrow(/at least 32/);
    expect(() => parseCredentialKeyRing({ AI_CREDENTIAL_ENCRYPTION_KEY: "short" })).toThrow();
    expect(() =>
      parseCredentialKeyRing({ ...env, AI_CREDENTIAL_ENCRYPTION_KEY_VERSION: "bad.version" }),
    ).toThrow();
    expect(() =>
      parseCredentialKeyRing({ ...env, AI_CREDENTIAL_ENCRYPTION_KEYS_PREVIOUS: "1:tooshort" }),
    ).toThrow(/malformed/);
    expect(() =>
      parseCredentialKeyRing({
        ...env,
        AI_CREDENTIAL_ENCRYPTION_KEYS_PREVIOUS: `1:${"z".repeat(40)}`,
      }),
    ).toThrow(/reuses/);
  });

  it("exposes only the last four characters of a key", () => {
    expect(keyLast4(`  ${KEY_A}  `)).toBe("AAAA");
  });
});
