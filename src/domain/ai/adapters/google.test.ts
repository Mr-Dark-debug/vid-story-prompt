import { describe, expect, it } from "vitest";
import { collect, jsonResponse, mockFetch, sseBlock, sseResponse } from "../test-helpers";
import { createGoogleAdapter } from "./google";

const KEY = "AIzaSyD-SECRETSECRETSECRET1234567890";

describe("google adapter", () => {
  it("paginates, keeps only generateContent text models, and strips the models/ prefix", async () => {
    const { fetcher, calls } = mockFetch([
      jsonResponse({
        models: [
          {
            name: "models/gemini-2.5-pro",
            displayName: "Gemini 2.5 Pro",
            inputTokenLimit: 1_048_576,
            outputTokenLimit: 65_536,
            supportedGenerationMethods: ["generateContent", "streamGenerateContent", "countTokens"],
          },
          {
            name: "models/text-embedding-004",
            displayName: "Embedding",
            supportedGenerationMethods: ["embedContent"],
          },
          {
            name: "models/gemini-2.5-flash-preview-tts",
            displayName: "TTS",
            supportedGenerationMethods: ["generateContent"],
          },
        ],
        nextPageToken: "page-2",
      }),
      jsonResponse({
        models: [
          {
            name: "models/gemma-3-27b-it",
            displayName: "Gemma 3 27B",
            inputTokenLimit: 131_072,
            outputTokenLimit: 8_192,
            supportedGenerationMethods: ["generateContent"],
          },
        ],
      }),
    ]);
    const models = await createGoogleAdapter({ fetch: fetcher }).listModels(KEY);
    expect(models.map((m) => m.modelId)).toEqual(["gemini-2.5-pro", "gemma-3-27b-it"]);
    expect(models[0]).toMatchObject({
      displayName: "Gemini 2.5 Pro",
      family: "google",
      contextWindow: 1_048_576,
      maxOutput: 65_536,
      supportsVision: true,
    });
    expect(models[1]).toMatchObject({ supportsVision: false, supportsJsonSchema: false });
    expect(calls[0].url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000",
    );
    expect(calls[1].url).toContain("pageToken=page-2");
    expect(calls[0].headers.get("x-goog-api-key")).toBe(KEY);
    expect(calls[0].url).not.toContain(KEY);
  });

  it("treats Google's 400 API_KEY_INVALID as an invalid key", async () => {
    const { fetcher } = mockFetch([
      jsonResponse(
        {
          error: {
            code: 400,
            message: "API key not valid. Please pass a valid API key.",
            status: "INVALID_ARGUMENT",
            details: [{ reason: "API_KEY_INVALID" }],
          },
        },
        { status: 400 },
      ),
    ]);
    expect(await createGoogleAdapter({ fetch: fetcher }).validateKey(KEY)).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("streams text, usage and finish reason from SSE chunks", async () => {
    const { fetcher, calls } = mockFetch([
      sseResponse([
        sseBlock({ candidates: [{ content: { role: "model", parts: [{ text: "Hel" }] } }] }),
        sseBlock({
          candidates: [
            {
              content: { parts: [{ text: "thinking", thought: true }, { text: "lo" }] },
              finishReason: "STOP",
            },
          ],
          usageMetadata: { promptTokenCount: 7, candidatesTokenCount: 2 },
        }),
      ]),
    ]);
    const deltas = await collect(
      createGoogleAdapter({ fetch: fetcher }).streamChat({
        apiKey: KEY,
        modelId: "gemini-2.5-pro",
        messages: [
          { role: "system", content: "Be brief" },
          { role: "user", content: "hi" },
          { role: "assistant", content: "hello" },
          { role: "user", content: "again" },
        ],
      }),
    );
    expect(deltas).toEqual([
      { type: "text", text: "Hel" },
      { type: "text", text: "lo" },
      { type: "usage", usage: { inputTokens: 7, outputTokens: 2 } },
      { type: "finish", reason: "stop" },
    ]);
    expect(calls[0].url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:streamGenerateContent?alt=sse",
    );
    expect(calls[0].body).toMatchObject({
      systemInstruction: { parts: [{ text: "Be brief" }] },
      contents: [
        { role: "user", parts: [{ text: "hi" }] },
        { role: "model", parts: [{ text: "hello" }] },
        { role: "user", parts: [{ text: "again" }] },
      ],
    });
  });

  it("reports a blocked prompt as content_filtered", async () => {
    const { fetcher } = mockFetch([
      sseResponse([sseBlock({ promptFeedback: { blockReason: "SAFETY" } })]),
    ]);
    const error = await collect(
      createGoogleAdapter({ fetch: fetcher }).streamChat({
        apiKey: KEY,
        modelId: "gemini-2.5-pro",
        messages: [{ role: "user", content: "x" }],
      }),
    ).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: "content_filtered", retryable: false });
  });

  it("requests JSON mode and parses the candidate text", async () => {
    const { fetcher, calls } = mockFetch([
      jsonResponse({
        candidates: [{ content: { parts: [{ text: '{"a":1}' }] }, finishReason: "STOP" }],
        usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 4 },
      }),
    ]);
    const result = await createGoogleAdapter({ fetch: fetcher }).completeJson({
      apiKey: KEY,
      modelId: "gemini-2.5-pro",
      messages: [{ role: "user", content: "go" }],
      schemaName: "s",
      schema: { type: "object" },
    });
    expect(result).toEqual({
      json: { a: 1 },
      usage: { inputTokens: 3, outputTokens: 4 },
      finishReason: "stop",
    });
    expect(calls[0].body).toMatchObject({
      generationConfig: { responseMimeType: "application/json" },
    });
  });
});
