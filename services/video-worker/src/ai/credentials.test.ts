import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.SUPABASE_URL = "https://worker-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "worker-test-service-role-key-long-enough";
});

import { encryptCredential, parseCredentialKeyRing } from "../vendor/ai/credential-crypto.js";
import {
  resolveWorkerLlm,
  type AiCredentialRepository,
  type StoredCredential,
} from "./credentials.js";

const WORKSPACE = "ws-1";
const USER = "user-1";
const ring = parseCredentialKeyRing({ AI_CREDENTIAL_ENCRYPTION_KEY: "k".repeat(40) });
const aad = (providerId: string) => ({ workspaceId: WORKSPACE, userId: USER, providerId });

async function stored(
  id: string,
  providerId: string,
  key: string,
  status: StoredCredential["status"] = "active",
) {
  const { envelope } = await encryptCredential(key, aad(providerId), ring);
  return {
    id,
    providerId,
    status,
    keyEncrypted: status === "revoked" ? null : envelope,
  } satisfies StoredCredential;
}

function repo(options: {
  preference?: { credentialId: string; modelId: string } | null;
  rows: StoredCredential[];
}) {
  const markInvalid = vi.fn().mockResolvedValue(undefined);
  const credentials = vi.fn(async (_w: string, _u: string, ids: string[]) =>
    options.rows.filter((row) => ids.includes(row.id)),
  );
  const repository: AiCredentialRepository = {
    preference: vi.fn(async () => options.preference ?? null),
    credentials,
    markInvalid,
  };
  return { repository, markInvalid, credentials };
}

const platform = { apiKey: "or-platform-key-0123456789", modelId: "anthropic/claude-sonnet-5" };
const base = { workspaceId: WORKSPACE, userId: USER, purpose: "clip_planning" as const, keyRing: ring };

describe("worker model resolution", () => {
  it("uses the explicitly chosen key and sends the decrypted key only as a header", async () => {
    const KEY = "sk-ant-api03-EXPLICITKEY0123456789";
    const { repository, credentials } = repo({ rows: [await stored("c1", "anthropic", KEY)] });
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [{ type: "text", text: '{"ok":true}' }],
          stop_reason: "end_turn",
          usage: { input_tokens: 3, output_tokens: 2 },
        }),
      ),
    );
    const { llm, resolution } = await resolveWorkerLlm({
      ...base,
      repository,
      platform,
      fetcher: fetcher as unknown as typeof fetch,
      explicit: { credentialId: "c1", modelId: "claude-opus-5" },
    });
    expect(resolution).toMatchObject({ source: "user_key", via: "explicit" });
    expect(llm).toMatchObject({
      source: "user_key",
      providerId: "anthropic",
      modelId: "claude-opus-5",
      credentialId: "c1",
    });
    expect(credentials).toHaveBeenCalledWith(WORKSPACE, USER, ["c1"]);

    await llm!.complete({ system: "s", user: "u", schemaName: "n", schema: { type: "object" } });
    const [, init] = fetcher.mock.calls[0];
    expect(new Headers(init.headers).get("x-api-key")).toBe(KEY);
    expect(String(init.body)).not.toContain(KEY);
  });

  it("falls back from an unusable choice to the saved default, recording why", async () => {
    const { repository } = repo({
      preference: { credentialId: "good", modelId: "gpt-4o" },
      rows: [
        await stored("dead", "openai", "sk-dead-0123456789", "invalid"),
        await stored("good", "openai", "sk-good-0123456789"),
      ],
    });
    const { llm, resolution } = await resolveWorkerLlm({
      ...base,
      repository,
      platform: null,
      explicit: { credentialId: "dead", modelId: "gpt-4o" },
    });
    expect(llm?.credentialId).toBe("good");
    expect(resolution).toMatchObject({
      source: "user_key",
      via: "preference",
      skipped: [{ via: "explicit", reason: "credential_invalid" }],
    });
  });

  it("uses the platform model only when the user has nothing usable, then deterministic", async () => {
    const { repository } = repo({
      rows: [await stored("gone", "openai", "sk-gone-0123456789", "revoked")],
    });
    const explicit = { credentialId: "gone", modelId: "m" };
    const withPlatform = await resolveWorkerLlm({ ...base, repository, platform, explicit });
    expect(withPlatform.llm).toMatchObject({
      source: "platform",
      providerId: "openrouter",
      credentialId: null,
    });
    expect(withPlatform.resolution).toMatchObject({
      source: "platform",
      skipped: [{ via: "explicit", reason: "credential_revoked" }],
    });

    const none = await resolveWorkerLlm({ ...base, repository, platform: null, explicit });
    expect(none.llm).toBeNull();
    expect(none.resolution).toMatchObject({ source: "deterministic" });
  });

  it("never reaches a credential outside the job owner's account", async () => {
    const { repository } = repo({ rows: [] }); // the scoped query finds nothing for a foreign id
    const result = await resolveWorkerLlm({
      ...base,
      repository,
      platform: null,
      explicit: { credentialId: "someone-elses", modelId: "m" },
    });
    expect(result.llm).toBeNull();
    expect(result.resolution).toMatchObject({
      skipped: [{ via: "explicit", reason: "credential_missing" }],
    });
  });

  it("treats a key this worker cannot decrypt as unusable without blaming the provider", async () => {
    const { repository, markInvalid } = repo({
      rows: [await stored("c1", "anthropic", "sk-ant-0123456789")],
    });
    const explicit = { credentialId: "c1", modelId: "m" };
    const wrongRing = parseCredentialKeyRing({ AI_CREDENTIAL_ENCRYPTION_KEY: "z".repeat(40) });
    const result = await resolveWorkerLlm({
      ...base,
      repository,
      platform: null,
      keyRing: wrongRing,
      explicit,
    });
    expect(result.llm).toBeNull();
    expect(result.decryptFailed).toBe(true);
    expect(markInvalid).not.toHaveBeenCalled();

    const noRing = await resolveWorkerLlm({
      ...base,
      repository,
      platform: null,
      keyRing: null,
      explicit,
    });
    expect(noRing.decryptFailed).toBe(true);
  });

  it("flags the credential when the provider rejects the key", async () => {
    const { repository, markInvalid } = repo({
      rows: [await stored("c1", "anthropic", "sk-ant-0123456789")],
    });
    const { llm } = await resolveWorkerLlm({
      ...base,
      repository,
      platform: null,
      explicit: { credentialId: "c1", modelId: "m" },
    });
    await llm!.onRejected!(Object.assign(new Error("rejected"), { code: "invalid_key" }) as never);
    expect(markInvalid).toHaveBeenCalledWith("c1", "invalid_key");
  });
});
