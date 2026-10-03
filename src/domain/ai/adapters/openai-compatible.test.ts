import { describe, expect, it } from "vitest";
import { collect, jsonResponse, mockFetch, sseBlock, sseResponse } from "../test-helpers";
import { createOpenAiCompatibleAdapter } from "./openai-compatible";

const KEY = "sk-proj-OPENAISECRETKEY000111222";

describe("openai adapter", () => {
  it("keeps only chat-capable models and never guesses limits it does not know", async () => {
    const { fetcher, calls } = mockFetch([
      jsonResponse({
        object: "list",
        data: [
          { id: "gpt-4o", created: 1_715_367_049 },
          { id: "gpt-4o-mini-2024-07-18", created: 1_721_172_717 },
          { id: "gpt-9-future", created: 1_900_000_000 },
          { id: "text-embedding-3-large", created: 1 },
          { id: "whisper-1", created: 1 },
          { id: "tts-1", created: 1 },
          { id: "dall-e-3", created: 1 },
          { id: "gpt-4o-transcribe", created: 1 },
          { id: "gpt-3.5-turbo-instruct", created: 1 },
          { id: "omni-moderation-latest", created: 1 },
          { id: "o3-mini", created: 1 },
        ],
      }),
    ]);
    const models = await createOpenAiCompatibleAdapter("openai", { fetch: fetcher }).listModels(
      KEY,
    );
    expect(models.map((m) => m.modelId)).toEqual([
      "gpt-4o",
      "gpt-4o-mini-2024-07-18",
      "gpt-9-future",
      "o3-mini",
    ]);
    expect(models[0]).toMatchObject({
      contextWindow: 128_000,
      maxOutput: 16_384,
      supportsVision: true,
    });
    expect(models[2]).toMatchObject({ contextWindow: null, maxOutput: null, family: "openai" });
    expect(calls[0].url).toBe("https://api.openai.com/v1/models");
    expect(calls[0].headers.get("authorization")).toBe(`Bearer ${KEY}`);
  });

  it("streams deltas, trailing usage chunk and [DONE]", async () => {
    const { fetcher, calls } = mockFetch([
      sseResponse([
        sseBlock({ choices: [{ delta: { role: "assistant", content: "" } }] }),
        sseBlock({ choices: [{ delta: { content: "Hi" } }] }),
        sseBlock({ choices: [{ delta: { content: " there" }, finish_reason: "stop" }] }),
        sseBlock({ choices: [], usage: { prompt_tokens: 9, completion_tokens: 3 } }),
        sseBlock("[DONE]"),
      ]),
    ]);
    const deltas = await collect(
      createOpenAiCompatibleAdapter("openai", { fetch: fetcher }).streamChat({
        apiKey: KEY,
        modelId: "o3-mini",
        temperature: 0.2,
        messages: [{ role: "user", content: "hi" }],
      }),
    );
    expect(deltas).toEqual([
      { type: "text", text: "Hi" },
      { type: "text", text: " there" },
      { type: "usage", usage: { inputTokens: 9, outputTokens: 3 } },
      { type: "finish", reason: "stop" },
    ]);
    const body = calls[0].body as Record<string, unknown>;
    expect(body.max_completion_tokens).toBe(4096);
    expect(body).not.toHaveProperty("max_tokens");
    // Reasoning-style models reject a custom temperature.
    expect(body).not.toHaveProperty("temperature");
    expect(body.stream_options).toEqual({ include_usage: true });
  });

  it("fails clearly when the stream ends without a finish reason", async () => {
    const { fetcher } = mockFetch([
      sseResponse([sseBlock({ choices: [{ delta: { content: "Hi" } }] })]),
    ]);
    const error = await collect(
      createOpenAiCompatibleAdapter("openai", { fetch: fetcher }).streamChat({
        apiKey: KEY,
        modelId: "gpt-4o",
        messages: [{ role: "user", content: "hi" }],
      }),
    ).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: "network" });
  });

  it("distinguishes exhausted quota from a transient rate limit", async () => {
    const quota = mockFetch([
      jsonResponse(
        { error: { code: "insufficient_quota", message: "You exceeded your current quota" } },
        { status: 429 },
      ),
    ]);
    const error = await createOpenAiCompatibleAdapter("openai", { fetch: quota.fetcher })
      .listModels(KEY)
      .catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: "quota_exceeded", retryable: false });
  });

  it("classifies context-length failures as non-retryable", async () => {
    const { fetcher } = mockFetch([
      jsonResponse(
        {
          error: {
            code: "context_length_exceeded",
            message: "This model's maximum context length is 128000 tokens.",
          },
        },
        { status: 400 },
      ),
    ]);
    const error = await createOpenAiCompatibleAdapter("openai", { fetch: fetcher })
      .completeJson({
        apiKey: KEY,
        modelId: "gpt-4o",
        messages: [{ role: "user", content: "x" }],
        schemaName: "s",
        schema: { type: "object" },
      })
      .catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: "context_length", retryable: false });
  });

  it("sends strict json_schema and parses the message content", async () => {
    const { fetcher, calls } = mockFetch([
      jsonResponse({
        choices: [{ message: { content: '{"candidates":[]}' }, finish_reason: "stop" }],
        usage: { prompt_tokens: 5, completion_tokens: 2 },
      }),
    ]);
    const result = await createOpenAiCompatibleAdapter("openai", { fetch: fetcher }).completeJson({
      apiKey: KEY,
      modelId: "gpt-4o",
      messages: [{ role: "user", content: "x" }],
      schemaName: "clip_candidates",
      schema: { type: "object" },
      temperature: 0.2,
    });
    expect(result.json).toEqual({ candidates: [] });
    expect(calls[0].body).toMatchObject({
      temperature: 0.2,
      response_format: {
        type: "json_schema",
        json_schema: { name: "clip_candidates", strict: true },
      },
    });
  });
});

describe("openrouter adapter", () => {
  const catalogue = {
    data: [
      {
        id: "anthropic/claude-sonnet-5",
        name: "Anthropic: Claude Sonnet 5",
        created: 1_780_000_000,
        context_length: 1_000_000,
        pricing: { prompt: "0.000003", completion: "0.000015" },
        architecture: { input_modalities: ["text", "image"], output_modalities: ["text"] },
        supported_parameters: ["temperature", "structured_outputs"],
        top_provider: { max_completion_tokens: 64_000 },
      },
      {
        id: "meta-llama/llama-3.3-70b-instruct:free",
        name: "Meta: Llama 3.3 70B Instruct (free)",
        context_length: 131_072,
        pricing: { prompt: "0", completion: "0" },
        architecture: { input_modalities: ["text"], output_modalities: ["text"] },
        supported_parameters: ["temperature"],
        top_provider: { max_completion_tokens: null },
      },
      {
        id: "black-forest-labs/flux-9",
        name: "Flux 9",
        architecture: { input_modalities: ["text"], output_modalities: ["image"] },
      },
    ],
  };

  it("normalizes catalogue entries and derives the maker family and price", async () => {
    const { fetcher, calls } = mockFetch([jsonResponse(catalogue)]);
    const models = await createOpenAiCompatibleAdapter("openrouter", { fetch: fetcher }).listModels(
      KEY,
    );
    expect(models.map((m) => m.modelId)).toEqual([
      "anthropic/claude-sonnet-5",
      "meta-llama/llama-3.3-70b-instruct:free",
    ]);
    expect(models[0]).toMatchObject({
      family: "anthropic",
      contextWindow: 1_000_000,
      maxOutput: 64_000,
      supportsVision: true,
      supportsJsonSchema: true,
      pricing: { inputPerMillion: 3, outputPerMillion: 15 },
    });
    expect(models[1]).toMatchObject({
      family: "meta",
      supportsVision: false,
      pricing: { inputPerMillion: 0, outputPerMillion: 0 },
    });
    expect(calls[0].url).toBe("https://openrouter.ai/api/v1/models?output_modalities=text");
  });

  it("validates against /key because /models is public", async () => {
    const ok = mockFetch([jsonResponse({ data: { label: "mine", disabled: false } })]);
    expect(
      await createOpenAiCompatibleAdapter("openrouter", { fetch: ok.fetcher }).validateKey(KEY),
    ).toEqual({ ok: true });
    expect(ok.calls[0].url).toBe("https://openrouter.ai/api/v1/key");

    const disabled = mockFetch([jsonResponse({ data: { disabled: true } })]);
    expect(
      await createOpenAiCompatibleAdapter("openrouter", { fetch: disabled.fetcher }).validateKey(
        KEY,
      ),
    ).toEqual({ ok: false, reason: "forbidden" });

    const bad = mockFetch([
      jsonResponse({ error: { message: "No auth credentials found", code: 401 } }, { status: 401 }),
    ]);
    expect(
      await createOpenAiCompatibleAdapter("openrouter", { fetch: bad.fetcher }).validateKey(KEY),
    ).toEqual({ ok: false, reason: "invalid" });
  });

  it("ignores keep-alive comments and surfaces mid-stream errors", async () => {
    const { fetcher } = mockFetch([
      sseResponse([
        ": OPENROUTER PROCESSING\n\n",
        sseBlock({ choices: [{ delta: { content: "A" } }] }),
        sseBlock({
          error: { code: 429, message: "rate" },
          choices: [{ finish_reason: "error", delta: { content: "" } }],
        }),
      ]),
    ]);
    const seen: unknown[] = [];
    const error = await (async () => {
      try {
        for await (const delta of createOpenAiCompatibleAdapter("openrouter", {
          fetch: fetcher,
        }).streamChat({
          apiKey: KEY,
          modelId: "anthropic/claude-sonnet-5",
          messages: [{ role: "user", content: "hi" }],
        })) {
          seen.push(delta);
        }
      } catch (caught) {
        return caught;
      }
    })();
    expect(seen).toEqual([{ type: "text", text: "A" }]);
    expect(error).toMatchObject({ code: "rate_limited" });
  });
});

describe("openai-compatible presets", () => {
  it("reads a bare array model list and skips non-chat models", async () => {
    const { fetcher, calls } = mockFetch([
      jsonResponse([
        {
          id: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
          type: "chat",
          display_name: "Llama 3.3 70B",
          context_length: 131_072,
        },
        { id: "BAAI/bge-large", type: "embedding" },
        { id: "black-forest-labs/FLUX.1", type: "image" },
      ]),
    ]);
    const models = await createOpenAiCompatibleAdapter("together", { fetch: fetcher }).listModels(
      KEY,
    );
    expect(models).toHaveLength(1);
    expect(models[0]).toMatchObject({
      family: "meta",
      displayName: "Llama 3.3 70B",
      contextWindow: 131_072,
    });
    expect(calls[0].url).toBe("https://api.together.xyz/v1/models");
  });

  it("uses max_tokens for hosts that expect it and filters Groq audio models", async () => {
    const list = mockFetch([
      jsonResponse({
        data: [
          {
            id: "llama-3.3-70b-versatile",
            context_window: 131_072,
            max_completion_tokens: 32_768,
            active: true,
          },
          { id: "whisper-large-v3", active: true },
          { id: "retired-model", active: false },
        ],
      }),
    ]);
    const groq = createOpenAiCompatibleAdapter("groq", { fetch: list.fetcher });
    const models = await groq.listModels(KEY);
    expect(models.map((m) => m.modelId)).toEqual(["llama-3.3-70b-versatile"]);
    expect(models[0]).toMatchObject({ family: "meta", maxOutput: 32_768 });

    const chat = mockFetch([
      sseResponse([
        sseBlock({ choices: [{ delta: { content: "x" }, finish_reason: "length" }] }),
        sseBlock("[DONE]"),
      ]),
    ]);
    const deltas = await collect(
      createOpenAiCompatibleAdapter("groq", { fetch: chat.fetcher }).streamChat({
        apiKey: KEY,
        modelId: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: "hi" }],
      }),
    );
    expect(deltas.at(-1)).toEqual({ type: "finish", reason: "length" });
    expect(chat.calls[0].body).toHaveProperty("max_tokens", 4096);
  });

  it("rejects providers that are not OpenAI-compatible", () => {
    expect(() => createOpenAiCompatibleAdapter("anthropic")).toThrow();
  });
});
