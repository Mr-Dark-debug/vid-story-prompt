import { describe, expect, it, vi } from "vitest";
import { jsonResponse, mockFetch } from "@/domain/ai/test-helpers";
import type { CredentialSnapshot, ModelSelection } from "@/domain/ai/resolution";
import { AiServiceError } from "./credential-service.server";
import { createModelResolver, type PlatformModel } from "./resolve.server";

const actor = { userId: "u", workspaceId: "w" };
const KEY = "sk-ant-api03-WEBRESOLVEKEY0123456789";
const openaiReply = (json: unknown) =>
  jsonResponse({
    choices: [{ message: { content: JSON.stringify(json) }, finish_reason: "stop" }],
    usage: { prompt_tokens: 4, completion_tokens: 2 },
  });
const anthropicReply = (json: unknown) =>
  jsonResponse({
    content: [{ type: "text", text: JSON.stringify(json) }],
    stop_reason: "end_turn",
    usage: { input_tokens: 5, output_tokens: 3 },
  });

function setup(options: {
  preference?: ModelSelection | null;
  snapshots?: Record<string, CredentialSnapshot>;
  platform?: PlatformModel;
  responses: Parameters<typeof mockFetch>[0];
}) {
  const http = mockFetch(options.responses);
  const resolveKey = vi.fn().mockResolvedValue({ apiKey: KEY });
  const markInvalid = vi.fn().mockResolvedValue(undefined);
  const resolver = createModelResolver({
    store: {
      preference: async () => options.preference ?? null,
      snapshots: async (_a, ids) =>
        new Map(Object.entries(options.snapshots ?? {}).filter(([id]) => ids.includes(id))),
    },
    credentials: { resolveKey, markInvalid },
    platform: () => options.platform ?? null,
    adapters: { fetch: http.fetcher },
  });
  const call = (explicit?: ModelSelection) =>
    resolver.run({
      actor,
      purpose: "editor_plan",
      explicit,
      system: "s",
      user: "u",
      schemaName: "n",
      schema: { type: "object" },
    });
  return { call, http, resolveKey, markInvalid };
}

describe("web model resolver", () => {
  it("prefers the explicit key, then the saved default, then the platform", async () => {
    const snapshots = {
      explicit: { providerId: "anthropic", status: "active" },
      pref: { providerId: "openai", status: "active" },
    } as const;
    const a = setup({
      preference: { credentialId: "pref", modelId: "gpt-4o" },
      snapshots,
      platform: { apiKey: "or-key-0123456789", modelId: "x/y" },
      responses: [anthropicReply({ ok: 1 })],
    });
    const explicit = await a.call({ credentialId: "explicit", modelId: "claude-opus-5" });
    expect(explicit).toMatchObject({
      source: "user_key",
      providerId: "anthropic",
      credentialId: "explicit",
      json: { ok: 1 },
      usage: { inputTokens: 5, outputTokens: 3 },
    });
    expect(a.http.calls[0].url).toContain("api.anthropic.com");

    const b = setup({
      preference: { credentialId: "pref", modelId: "gpt-4o" },
      snapshots,
      responses: [openaiReply({ ok: 2 })],
    });
    expect(await b.call()).toMatchObject({
      source: "user_key",
      providerId: "openai",
      modelId: "gpt-4o",
    });

    const c = setup({
      platform: { apiKey: "or-key-0123456789", modelId: "x/y" },
      responses: [openaiReply({ ok: 3 })],
    });
    const platform = await c.call();
    expect(platform).toMatchObject({
      source: "platform",
      providerId: "openrouter",
      modelId: "x/y",
      credentialId: null,
    });
    expect(c.resolveKey).not.toHaveBeenCalled();
  });

  it("says so, rather than guessing, when nothing is usable", async () => {
    const none = setup({ responses: [] });
    await expect(none.call()).rejects.toMatchObject({
      code: "not_configured",
      message: expect.stringMatching(/Connect a provider key/),
    });

    const dead = setup({
      snapshots: { dead: { providerId: "anthropic", status: "invalid" } },
      responses: [],
    });
    await expect(dead.call({ credentialId: "dead", modelId: "m" })).rejects.toMatchObject({
      code: "not_configured",
      message: expect.stringMatching(/Reconnect/),
    });
    expect(dead.http.calls).toHaveLength(0);
  });

  it("flags a rejected key and never leaks it", async () => {
    const s = setup({
      snapshots: { c1: { providerId: "anthropic", status: "active" } },
      responses: [
        jsonResponse({ error: { message: `invalid x-api-key ${KEY}` } }, { status: 401 }),
      ],
    });
    const error = await s
      .call({ credentialId: "c1", modelId: "m" })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AiServiceError);
    expect(error).toMatchObject({ code: "key_invalid" });
    expect(s.markInvalid).toHaveBeenCalledWith({
      ...actor,
      credentialId: "c1",
      code: "invalid_key",
    });
    expect((error as Error).message).not.toContain(KEY);
  });

  it("classifies transient failures without exposing provider text", async () => {
    const s = setup({
      snapshots: { c1: { providerId: "anthropic", status: "active" } },
      responses: [
        jsonResponse(
          { error: { message: "secret internal detail" } },
          { status: 429, headers: { "retry-after": "12" } },
        ),
      ],
    });
    const error = await s
      .call({ credentialId: "c1", modelId: "m" })
      .catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: "rate_limited", retryAfterSeconds: 12 });
    expect((error as Error).message).not.toContain("secret internal detail");
    expect(s.markInvalid).not.toHaveBeenCalled();
  });
});
