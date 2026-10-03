import { describe, expect, it } from "vitest";
import { AiProviderError } from "../errors";
import { collect, jsonResponse, mockFetch, sseBlock, sseResponse } from "../test-helpers";
import { createAnthropicAdapter, toAnthropicSchema } from "./anthropic";

const KEY = "sk-ant-api03-SECRETSECRETSECRET1234";

const modelPage1 = {
  data: [
    {
      type: "model",
      id: "claude-opus-5",
      display_name: "Claude Opus 5",
      created_at: "2026-07-24T00:00:00Z",
      max_input_tokens: 1_000_000,
      max_tokens: 128_000,
      capabilities: {
        image_input: { supported: true },
        structured_outputs: { supported: true },
      },
    },
  ],
  has_more: true,
  last_id: "claude-opus-5",
  first_id: "claude-opus-5",
};
const modelPage2 = {
  data: [
    {
      type: "model",
      id: "claude-legacy",
      display_name: "Claude Legacy",
      created_at: "1970-01-01T00:00:00Z",
      max_input_tokens: null,
      max_tokens: null,
      capabilities: null,
    },
  ],
  has_more: false,
  last_id: "claude-legacy",
  first_id: "claude-legacy",
};

describe("anthropic adapter", () => {
  it("lists and normalizes models across pages using x-api-key headers", async () => {
    const { fetcher, calls } = mockFetch([jsonResponse(modelPage1), jsonResponse(modelPage2)]);
    const models = await createAnthropicAdapter({ fetch: fetcher }).listModels(KEY);

    expect(models).toHaveLength(2);
    expect(models[0]).toMatchObject({
      providerId: "anthropic",
      modelId: "claude-opus-5",
      displayName: "Claude Opus 5",
      family: "anthropic",
      contextWindow: 1_000_000,
      maxOutput: 128_000,
      supportsVision: true,
      supportsJsonSchema: true,
    });
    expect(models[1]).toMatchObject({
      contextWindow: null,
      supportsVision: false,
      createdAt: undefined,
    });
    expect(calls[0].url).toBe("https://api.anthropic.com/v1/models?limit=1000");
    expect(calls[1].url).toContain("after_id=claude-opus-5");
    expect(calls[0].headers.get("x-api-key")).toBe(KEY);
    expect(calls[0].headers.get("anthropic-version")).toBe("2023-06-01");
    expect(calls[0].headers.get("authorization")).toBeNull();
    expect(calls[0].url).not.toContain(KEY);
  });

  it("maps validation outcomes without throwing", async () => {
    const adapter = (status: number) =>
      createAnthropicAdapter({
        fetch: mockFetch([jsonResponse({ error: { message: "nope" } }, { status })]).fetcher,
      });
    expect(await adapter(200).validateKey(KEY)).toEqual({ ok: true });
    expect(await adapter(401).validateKey(KEY)).toEqual({ ok: false, reason: "invalid" });
    expect(await adapter(403).validateKey(KEY)).toEqual({ ok: false, reason: "forbidden" });
    expect(await adapter(429).validateKey(KEY)).toEqual({ ok: false, reason: "rate_limited" });
    expect(await adapter(503).validateKey(KEY)).toEqual({ ok: false, reason: "network" });
  });

  it("surfaces 429 with Retry-After as retryable", async () => {
    const { fetcher } = mockFetch([
      jsonResponse(
        { error: { type: "rate_limit_error", message: "slow down" } },
        { status: 429, headers: { "retry-after": "17" } },
      ),
    ]);
    const error = await createAnthropicAdapter({ fetch: fetcher })
      .listModels(KEY)
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AiProviderError);
    expect(error).toMatchObject({ code: "rate_limited", retryAfterSeconds: 17, retryable: true });
  });

  it("streams text, usage and the finish reason", async () => {
    const { fetcher, calls } = mockFetch([
      sseResponse([
        sseBlock(
          { type: "message_start", message: { usage: { input_tokens: 25, output_tokens: 1 } } },
          "message_start",
        ),
        sseBlock({ type: "ping" }, "ping"),
        sseBlock(
          { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Hel" } },
          "content_block_delta",
        ),
        sseBlock(
          { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "lo" } },
          "content_block_delta",
        ),
        sseBlock(
          {
            type: "message_delta",
            delta: { stop_reason: "end_turn" },
            usage: { output_tokens: 15 },
          },
          "message_delta",
        ),
        sseBlock({ type: "message_stop" }, "message_stop"),
      ]),
    ]);
    const deltas = await collect(
      createAnthropicAdapter({ fetch: fetcher }).streamChat({
        apiKey: KEY,
        modelId: "claude-opus-5",
        messages: [
          { role: "system", content: "Be brief." },
          { role: "user", content: "Hi" },
          { role: "user", content: "again" },
        ],
      }),
    );
    expect(deltas).toEqual([
      { type: "text", text: "Hel" },
      { type: "text", text: "lo" },
      { type: "usage", usage: { inputTokens: 25, outputTokens: 15 } },
      { type: "finish", reason: "stop" },
    ]);
    expect(calls[0].body).toMatchObject({
      model: "claude-opus-5",
      stream: true,
      system: "Be brief.",
      max_tokens: 4096,
      messages: [{ role: "user", content: "Hi\n\nagain" }],
    });
  });

  it("raises a classified error for a mid-stream overload event", async () => {
    const { fetcher } = mockFetch([
      sseResponse([
        sseBlock({ type: "content_block_delta", delta: { type: "text_delta", text: "x" } }),
        sseBlock({ type: "error", error: { type: "overloaded_error", message: "Overloaded" } }),
      ]),
    ]);
    const error = await collect(
      createAnthropicAdapter({ fetch: fetcher }).streamChat({
        apiKey: KEY,
        modelId: "m",
        messages: [{ role: "user", content: "hi" }],
      }),
    ).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: "provider_unavailable", retryable: true });
  });

  it("stops when the caller aborts", async () => {
    const controller = new AbortController();
    controller.abort();
    const { fetcher } = mockFetch([]);
    const error = await collect(
      createAnthropicAdapter({ fetch: fetcher }).streamChat({
        apiKey: KEY,
        modelId: "m",
        messages: [{ role: "user", content: "hi" }],
        signal: controller.signal,
      }),
    ).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: "aborted" });
  });

  it("requests schema-constrained JSON and strips keywords Anthropic rejects", async () => {
    const { fetcher, calls } = mockFetch([
      jsonResponse({
        content: [{ type: "text", text: '{"ok":true}' }],
        stop_reason: "end_turn",
        usage: { input_tokens: 10, output_tokens: 4 },
      }),
    ]);
    const result = await createAnthropicAdapter({ fetch: fetcher }).completeJson({
      apiKey: KEY,
      modelId: "claude-opus-5",
      messages: [{ role: "user", content: "go" }],
      schemaName: "thing",
      schema: { type: "object", properties: { n: { type: "number", minimum: 0, maximum: 100 } } },
    });
    expect(result).toEqual({
      json: { ok: true },
      usage: { inputTokens: 10, outputTokens: 4 },
      finishReason: "stop",
    });
    const sent = calls[0].body as { output_config: { format: { type: string; schema: unknown } } };
    expect(sent.output_config.format.type).toBe("json_schema");
    expect(JSON.stringify(sent.output_config.format.schema)).not.toMatch(/minimum|maximum/);
  });

  it("falls back to a prompt-embedded schema when structured outputs are rejected", async () => {
    const { fetcher, calls } = mockFetch([
      jsonResponse({ error: { message: "output_config is not supported" } }, { status: 400 }),
      jsonResponse({
        content: [{ type: "text", text: '```json\n{"a":1}\n```' }],
        stop_reason: "end_turn",
        usage: {},
      }),
    ]);
    const result = await createAnthropicAdapter({ fetch: fetcher }).completeJson({
      apiKey: KEY,
      modelId: "claude-old",
      messages: [{ role: "user", content: "go" }],
      schemaName: "thing",
      schema: { type: "object" },
    });
    expect(result.json).toEqual({ a: 1 });
    expect(calls).toHaveLength(2);
    expect(calls[1].body).not.toHaveProperty("output_config");
    expect(String((calls[1].body as { system: string }).system)).toContain("JSON Schema");
  });

  it("sanitizes schemas without mutating unrelated structure", () => {
    expect(
      toAnthropicSchema({
        type: "object",
        required: ["a"],
        properties: {
          a: { type: "array", minItems: 3, maxItems: 9, items: { type: "string", maxLength: 4 } },
        },
      }),
    ).toEqual({
      type: "object",
      required: ["a"],
      additionalProperties: false,
      properties: { a: { type: "array", minItems: 1, items: { type: "string" } } },
    });
  });
});
