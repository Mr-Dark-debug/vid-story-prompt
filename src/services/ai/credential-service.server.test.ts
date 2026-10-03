import { describe, expect, it } from "vitest";
import { parseCredentialKeyRing } from "@/domain/ai/credential-crypto";
import { jsonResponse, mockFetch } from "@/domain/ai/test-helpers";
import {
  AiServiceError,
  LabelConflictError,
  MODEL_CACHE_TTL_MS,
  VALIDATION_LIMIT,
  createCredentialService,
  type Actor,
  type CredentialPatch,
  type CredentialRecord,
  type CredentialStore,
} from "./credential-service.server";

const alice: Actor = { userId: "user-alice", workspaceId: "ws-alice" };
const bob: Actor = { userId: "user-bob", workspaceId: "ws-bob" };
const KEY = "sk-ant-api03-ROUNDTRIPSECRET0123456789";
const ring = parseCredentialKeyRing({ AI_CREDENTIAL_ENCRYPTION_KEY: "k".repeat(40) });

function memoryStore() {
  const rows = new Map<string, CredentialRecord>();
  const attempts: Array<{ userId: string; at: number; outcome: string }> = [];
  const models = new Map<string, { count: number; fetchedAt: string }>();
  const deletedPrefs: string[] = [];
  let sequence = 0;
  const clock = { now: Date.parse("2026-10-03T12:00:00Z") };
  const store: CredentialStore = {
    async countAttempts(userId, sinceIso) {
      return attempts.filter((a) => a.userId === userId && a.at >= Date.parse(sinceIso)).length;
    },
    async recordAttempt(a) {
      attempts.push({ userId: a.userId, at: clock.now, outcome: a.outcome });
    },
    async insert(row) {
      for (const r of rows.values()) {
        if (
          r.workspaceId === row.workspaceId &&
          r.userId === row.userId &&
          r.providerId === row.providerId &&
          r.label === row.label
        )
          throw new LabelConflictError();
      }
      const record: CredentialRecord = {
        id: `cred-${++sequence}`,
        workspaceId: row.workspaceId,
        userId: row.userId,
        providerId: row.providerId,
        label: row.label,
        keyEncrypted: row.keyEncrypted,
        keyVersion: row.keyVersion,
        keyLast4: row.keyLast4,
        status: "active",
        lastVerifiedAt: row.lastVerifiedAt,
        lastErrorCode: null,
      };
      rows.set(record.id, record);
      return record;
    },
    async get(id, actor) {
      const r = rows.get(id);
      return r && r.userId === actor.userId && r.workspaceId === actor.workspaceId
        ? { ...r }
        : null;
    },
    async update(id, patch: CredentialPatch) {
      const r = rows.get(id);
      if (r) Object.assign(r, patch);
    },
    async remove(id) {
      rows.delete(id);
      models.delete(id);
    },
    async deletePreferences(id) {
      deletedPrefs.push(id);
    },
    async saveModels(id, _actor, list) {
      models.set(id, { count: list.length, fetchedAt: new Date(clock.now).toISOString() });
    },
    async deleteModels(id) {
      models.delete(id);
    },
    async modelsFetchedAt(id) {
      return models.get(id)?.fetchedAt ?? null;
    },
  };
  return { store, rows, attempts, models, deletedPrefs, clock };
}

const okValidation = () => jsonResponse({ data: [] });
const okModels = () =>
  jsonResponse({
    data: [
      {
        id: "claude-opus-5",
        display_name: "Claude Opus 5",
        max_input_tokens: 1000,
        max_tokens: 100,
        capabilities: null,
        created_at: "2026-07-24T00:00:00Z",
      },
    ],
    has_more: false,
    last_id: "claude-opus-5",
  });

function setup(responses: Parameters<typeof mockFetch>[0], keyRing = () => ring) {
  const mem = memoryStore();
  const http = mockFetch(responses);
  const service = createCredentialService({
    store: mem.store,
    keyRing,
    adapters: { fetch: http.fetcher },
    now: () => mem.clock.now,
  });
  return { ...mem, http, service };
}

describe("credential service", () => {
  it("validates, encrypts at rest, caches models and never returns the key", async () => {
    const { service, rows, http } = setup([okValidation(), okModels()]);
    const result = await service.connect({
      ...alice,
      providerId: "anthropic",
      label: " Personal ",
      apiKey: ` ${KEY} `,
    });

    expect(result).toEqual({ id: "cred-1", modelCount: 1 });
    expect(JSON.stringify(result)).not.toContain(KEY);
    const stored = rows.get("cred-1")!;
    expect(stored.label).toBe("Personal");
    expect(stored.keyLast4).toBe("6789");
    expect(stored.keyEncrypted).toMatch(/^aik1\.1\./);
    expect(JSON.stringify(stored)).not.toContain(KEY);
    expect(http.calls[0].url).toContain("/v1/models?limit=1");
  });

  it("rejects a key the provider refuses and stores nothing", async () => {
    const { service, rows, attempts } = setup([
      jsonResponse({ error: { message: "bad" } }, { status: 401 }),
    ]);
    const error = await service
      .connect({ ...alice, providerId: "anthropic", label: "x", apiKey: KEY })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AiServiceError);
    expect(error).toMatchObject({ code: "key_invalid" });
    expect((error as Error).message).not.toContain(KEY);
    expect(rows.size).toBe(0);
    expect(attempts.map((a) => a.outcome)).toEqual(["invalid"]);
  });

  it("keeps a valid key even when model listing fails, so it can be retried", async () => {
    const { service, rows } = setup([okValidation(), jsonResponse({}, { status: 503 })]);
    const result = await service.connect({
      ...alice,
      providerId: "anthropic",
      label: "x",
      apiKey: KEY,
    });
    expect(result.modelCount).toBeNull();
    expect(rows.size).toBe(1);
  });

  it("enforces the per-user validation rate limit across providers", async () => {
    const { service, attempts, clock } = setup([]);
    for (let i = 0; i < VALIDATION_LIMIT; i++)
      attempts.push({ userId: alice.userId, at: clock.now, outcome: "ok" });
    const error = await service
      .connect({ ...alice, providerId: "anthropic", label: "x", apiKey: KEY })
      .catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: "rate_limited" });
    // Another user is unaffected by Alice's attempts.
    const other = setup([okValidation(), okModels()]);
    for (let i = 0; i < VALIDATION_LIMIT; i++)
      other.attempts.push({ userId: alice.userId, at: other.clock.now, outcome: "ok" });
    await expect(
      other.service.connect({ ...bob, providerId: "anthropic", label: "x", apiKey: KEY }),
    ).resolves.toBeTruthy();
  });

  it("rejects unknown providers, bad labels and malformed keys before any network call", async () => {
    const { service, http } = setup([]);
    await expect(
      service.connect({ ...alice, providerId: "nope", label: "x", apiKey: KEY }),
    ).rejects.toMatchObject({ code: "invalid_input" });
    await expect(
      service.connect({
        ...alice,
        providerId: "anthropic",
        label: "x",
        apiKey: "has space inside it",
      }),
    ).rejects.toMatchObject({ code: "invalid_input" });
    await expect(
      service.connect({ ...alice, providerId: "anthropic", label: "   ", apiKey: KEY }),
    ).rejects.toMatchObject({ code: "invalid_input" });
    expect(http.calls).toHaveLength(0);
  });

  it("reports label conflicts without leaking details", async () => {
    const { service } = setup([okValidation(), okModels(), okValidation()]);
    await service.connect({ ...alice, providerId: "anthropic", label: "Same", apiKey: KEY });
    await expect(
      service.connect({ ...alice, providerId: "anthropic", label: "Same", apiKey: KEY }),
    ).rejects.toMatchObject({ code: "label_taken" });
  });

  it("is honestly unavailable when no encryption key is configured", async () => {
    const { service } = setup([], () => {
      throw new Error("AI_CREDENTIAL_ENCRYPTION_KEY must be set");
    });
    await expect(
      service.connect({ ...alice, providerId: "anthropic", label: "x", apiKey: KEY }),
    ).rejects.toMatchObject({ code: "not_configured" });
  });

  it("scopes every lookup to the acting user and workspace", async () => {
    const { service } = setup([okValidation(), okModels()]);
    const { id } = await service.connect({
      ...alice,
      providerId: "anthropic",
      label: "x",
      apiKey: KEY,
    });
    for (const call of [
      () => service.revalidate({ ...bob, credentialId: id }),
      () => service.refreshModels({ ...bob, credentialId: id, force: true }),
      () => service.revoke({ ...bob, credentialId: id }),
      () => service.remove({ ...bob, credentialId: id }),
      () => service.resolveKey({ ...bob, credentialId: id }),
      () => service.replaceKey({ ...bob, credentialId: id, apiKey: KEY }),
    ]) {
      await expect(call()).rejects.toMatchObject({ code: "not_found" });
    }
  });

  it("marks a key invalid when revalidation is rejected, but not on rate limits or outages", async () => {
    const { service, rows } = setup([
      okValidation(),
      okModels(),
      jsonResponse({}, { status: 429 }),
      jsonResponse({}, { status: 503 }),
      jsonResponse({}, { status: 401 }),
    ]);
    const { id } = await service.connect({
      ...alice,
      providerId: "anthropic",
      label: "x",
      apiKey: KEY,
    });
    await expect(service.revalidate({ ...alice, credentialId: id })).rejects.toMatchObject({
      code: "rate_limited",
    });
    expect(rows.get(id)).toMatchObject({ status: "active", lastErrorCode: "rate_limited" });
    await expect(service.revalidate({ ...alice, credentialId: id })).rejects.toMatchObject({
      code: "network",
    });
    expect(rows.get(id)!.status).toBe("active");
    await expect(service.revalidate({ ...alice, credentialId: id })).resolves.toEqual({
      status: "invalid",
    });
    expect(rows.get(id)).toMatchObject({ status: "invalid", lastErrorCode: "invalid_key" });
    await expect(service.resolveKey({ ...alice, credentialId: id })).rejects.toMatchObject({
      code: "key_invalid",
    });
  });

  it("replaces a key, reactivating an invalid connection", async () => {
    const { service, rows } = setup([okValidation(), okModels(), okValidation(), okModels()]);
    const { id } = await service.connect({
      ...alice,
      providerId: "anthropic",
      label: "x",
      apiKey: KEY,
    });
    rows.get(id)!.status = "invalid";
    const newKey = "sk-ant-api03-NEWNEWNEWNEWNEW0000ZZZZ";
    await service.replaceKey({ ...alice, credentialId: id, apiKey: newKey });
    const record = rows.get(id)!;
    expect(record).toMatchObject({ status: "active", keyLast4: "ZZZZ", lastErrorCode: null });
    expect((await service.resolveKey({ ...alice, credentialId: id })).apiKey).toBe(newKey);
  });

  it("resolves the plaintext key only on the server path and round-trips it", async () => {
    const { service } = setup([okValidation(), okModels()]);
    const { id } = await service.connect({
      ...alice,
      providerId: "anthropic",
      label: "x",
      apiKey: KEY,
    });
    await expect(service.resolveKey({ ...alice, credentialId: id })).resolves.toEqual({
      apiKey: KEY,
      providerId: "anthropic",
      credentialId: id,
    });
  });

  it("revokes by wiping ciphertext, defaults and cached models", async () => {
    const { service, rows, deletedPrefs, models } = setup([okValidation(), okModels()]);
    const { id } = await service.connect({
      ...alice,
      providerId: "anthropic",
      label: "x",
      apiKey: KEY,
    });
    await service.revoke({ ...alice, credentialId: id });
    expect(rows.get(id)).toMatchObject({ status: "revoked", keyEncrypted: null, keyVersion: null });
    expect(deletedPrefs).toEqual([id]);
    expect(models.has(id)).toBe(false);
    await expect(service.resolveKey({ ...alice, credentialId: id })).rejects.toMatchObject({
      code: "revoked",
    });
    await expect(service.revalidate({ ...alice, credentialId: id })).rejects.toMatchObject({
      code: "revoked",
    });
  });

  it("removes the row entirely on delete", async () => {
    const { service, rows } = setup([okValidation(), okModels()]);
    const { id } = await service.connect({
      ...alice,
      providerId: "anthropic",
      label: "x",
      apiKey: KEY,
    });
    await service.remove({ ...alice, credentialId: id });
    expect(rows.size).toBe(0);
  });

  it("honours the model cache TTL unless forced", async () => {
    const { service, clock, http } = setup([okValidation(), okModels(), okModels(), okModels()]);
    const { id } = await service.connect({
      ...alice,
      providerId: "anthropic",
      label: "x",
      apiKey: KEY,
    });
    expect(await service.refreshModels({ ...alice, credentialId: id })).toEqual({
      refreshed: false,
    });
    clock.now += MODEL_CACHE_TTL_MS + 1_000;
    expect(await service.refreshModels({ ...alice, credentialId: id })).toMatchObject({
      refreshed: true,
      modelCount: 1,
    });
    expect(await service.refreshModels({ ...alice, credentialId: id, force: true })).toMatchObject({
      refreshed: true,
    });
    expect(http.calls).toHaveLength(4);
  });

  it("flags the credential invalid when a model refresh proves the key is dead", async () => {
    const { service, rows } = setup([
      okValidation(),
      okModels(),
      jsonResponse({}, { status: 401 }),
    ]);
    const { id } = await service.connect({
      ...alice,
      providerId: "anthropic",
      label: "x",
      apiKey: KEY,
    });
    await expect(
      service.refreshModels({ ...alice, credentialId: id, force: true }),
    ).rejects.toMatchObject({ code: "key_invalid" });
    expect(rows.get(id)!.status).toBe("invalid");
  });

  it("re-encrypts opportunistically after the key ring rotates", async () => {
    const old = parseCredentialKeyRing({
      AI_CREDENTIAL_ENCRYPTION_KEY: "k".repeat(40),
      AI_CREDENTIAL_ENCRYPTION_KEY_VERSION: "1",
    });
    const rotated = parseCredentialKeyRing({
      AI_CREDENTIAL_ENCRYPTION_KEY: "n".repeat(40),
      AI_CREDENTIAL_ENCRYPTION_KEY_VERSION: "2",
      AI_CREDENTIAL_ENCRYPTION_KEYS_PREVIOUS: `1:${"k".repeat(40)}`,
    });
    let active = old;
    const { service, rows } = setup([okValidation(), okModels()], () => active);
    const { id } = await service.connect({
      ...alice,
      providerId: "anthropic",
      label: "x",
      apiKey: KEY,
    });
    expect(rows.get(id)!.keyVersion).toBe("1");
    active = rotated;
    expect((await service.resolveKey({ ...alice, credentialId: id })).apiKey).toBe(KEY);
    expect(rows.get(id)!.keyVersion).toBe("2");
    expect(rows.get(id)!.keyEncrypted).toMatch(/^aik1\.2\./);
  });

  it("reports an unreadable ciphertext as a reconnect prompt, not a crash or a leak", async () => {
    const { service, rows } = setup([okValidation(), okModels()]);
    const { id } = await service.connect({
      ...alice,
      providerId: "anthropic",
      label: "x",
      apiKey: KEY,
    });
    rows.get(id)!.keyEncrypted = "aik1.1.AAAA.BBBB";
    const error = await service
      .resolveKey({ ...alice, credentialId: id })
      .catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: "decrypt_failed" });
    expect((error as Error).message).not.toContain(KEY);
  });
});
