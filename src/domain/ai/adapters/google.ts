import { AiProviderError } from "../errors.js";
import {
  asNumber,
  asRecord,
  asString,
  parseJsonText,
  parseSseJson,
  providerFetch,
  readJson,
  readSse,
} from "../http.js";
import { requireAiProvider } from "../providers.js";
import type {
  AdapterDeps,
  ChatDelta,
  ChatMessageInput,
  ChatRequest,
  FinishReason,
  JsonRequest,
  JsonResult,
  KeyValidation,
  NormalizedModel,
  ProviderAdapter,
  TokenUsage,
} from "../types.js";

const PROVIDER_ID = "google";
const MAX_MODEL_PAGES = 5;

/** generateContent also serves image, speech, live and robotics models that cannot chat in text. */
const NON_TEXT_MODEL =
  /(-tts|tts-|image|imagen|veo|embedding|aqa|robotics|native-audio|live|computer-use|learnlm)/i;

function stripPrefix(name: string) {
  return name.startsWith("models/") ? name.slice("models/".length) : name;
}

function mapFinish(reason: unknown): FinishReason {
  switch (reason) {
    case "STOP":
      return "stop";
    case "MAX_TOKENS":
      return "length";
    case "SAFETY":
    case "RECITATION":
    case "BLOCKLIST":
    case "PROHIBITED_CONTENT":
    case "SPII":
    case "IMAGE_SAFETY":
      return "content_filter";
    default:
      return "other";
  }
}

function readUsage(value: unknown): TokenUsage {
  const usage = asRecord(value);
  return {
    inputTokens: asNumber(usage.promptTokenCount),
    outputTokens: asNumber(usage.candidatesTokenCount),
  };
}

function toContents(messages: ChatMessageInput[]) {
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
  const contents: { role: "user" | "model"; parts: { text: string }[] }[] = [];
  for (const message of messages) {
    if (message.role === "system") continue;
    const role = message.role === "assistant" ? "model" : "user";
    const last = contents[contents.length - 1];
    if (last && last.role === role) last.parts.push({ text: message.content });
    else contents.push({ role, parts: [{ text: message.content }] });
  }
  return { system: system || undefined, contents };
}

function candidateText(candidate: Record<string, unknown>): string {
  const parts = asRecord(candidate.content).parts;
  if (!Array.isArray(parts)) return "";
  return (
    parts
      .map((part) => asRecord(part))
      // `thought` parts are the model's reasoning summary, not the answer.
      .filter((part) => part.thought !== true && typeof part.text === "string")
      .map((part) => part.text as string)
      .join("")
  );
}

function assertNotBlocked(payload: Record<string, unknown>, label: string) {
  const reason = asString(asRecord(payload.promptFeedback).blockReason);
  if (reason) {
    throw new AiProviderError(
      PROVIDER_ID,
      "content_filtered",
      `${label} blocked the prompt (${reason}).`,
    );
  }
}

export function createGoogleAdapter(deps: AdapterDeps = {}): ProviderAdapter {
  const provider = requireAiProvider(PROVIDER_ID);
  const call = (
    apiKey: string,
    path: string,
    init: { body?: unknown; signal?: AbortSignal; timeoutMs?: number } = {},
  ) =>
    providerFetch({
      providerId: PROVIDER_ID,
      providerLabel: provider.label,
      url: `${provider.baseUrl}${path}`,
      headers: { "x-goog-api-key": apiKey },
      secrets: [apiKey],
      fetcher: deps.fetch,
      ...init,
    });

  const generationConfig = (
    request: { maxOutputTokens?: number; temperature?: number },
    extra: Record<string, unknown> = {},
  ) => ({
    ...(request.maxOutputTokens ? { maxOutputTokens: request.maxOutputTokens } : {}),
    ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
    ...extra,
  });

  return {
    providerId: PROVIDER_ID,

    async validateKey(apiKey, signal): Promise<KeyValidation> {
      try {
        await call(apiKey, "/models?pageSize=1", { signal, timeoutMs: 15_000 });
        return { ok: true };
      } catch (error) {
        if (!(error instanceof AiProviderError)) return { ok: false, reason: "network" };
        if (error.code === "invalid_key") return { ok: false, reason: "invalid" };
        if (error.code === "forbidden") return { ok: false, reason: "forbidden" };
        if (error.code === "rate_limited") return { ok: false, reason: "rate_limited" };
        return { ok: false, reason: "network" };
      }
    },

    async listModels(apiKey, signal) {
      const models: NormalizedModel[] = [];
      let pageToken: string | null = null;
      for (let page = 0; page < MAX_MODEL_PAGES; page++) {
        const query: string = `pageSize=1000${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
        const response = await call(apiKey, `/models?${query}`, { signal });
        const payload = asRecord(await readJson(response, PROVIDER_ID, provider.label));
        for (const entry of Array.isArray(payload.models) ? payload.models : []) {
          const record = asRecord(entry);
          const name = asString(record.name);
          const methods = Array.isArray(record.supportedGenerationMethods)
            ? record.supportedGenerationMethods
            : [];
          if (!name || !methods.includes("generateContent")) continue;
          const modelId = stripPrefix(name);
          if (NON_TEXT_MODEL.test(modelId)) continue;
          const isGemini = modelId.startsWith("gemini");
          models.push({
            providerId: PROVIDER_ID,
            modelId,
            displayName: asString(record.displayName) ?? modelId,
            family: "google",
            contextWindow: asNumber(record.inputTokenLimit),
            maxOutput: asNumber(record.outputTokenLimit),
            // Gemini models accept images; Gemma and others are not assumed to.
            supportsVision: isGemini,
            supportsJsonSchema: isGemini,
            supportsStreaming: methods.includes("streamGenerateContent") || isGemini,
          });
        }
        pageToken = asString(payload.nextPageToken);
        if (!pageToken) break;
      }
      return models;
    },

    async *streamChat(chat: ChatRequest): AsyncGenerator<ChatDelta> {
      const { system, contents } = toContents(chat.messages);
      const response = await call(
        chat.apiKey,
        `/models/${encodeURIComponent(chat.modelId)}:streamGenerateContent?alt=sse`,
        {
          timeoutMs: 120_000,
          signal: chat.signal,
          body: {
            contents,
            ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
            generationConfig: generationConfig(chat),
          },
        },
      );
      let finish: FinishReason | null = null;
      let usage: TokenUsage | null = null;
      for await (const event of readSse(response, {
        providerId: PROVIDER_ID,
        providerLabel: provider.label,
        signal: chat.signal,
        secrets: [chat.apiKey],
      })) {
        const payload = asRecord(parseSseJson(event.data, PROVIDER_ID, provider.label));
        assertNotBlocked(payload, provider.label);
        const candidate = asRecord(
          Array.isArray(payload.candidates) ? payload.candidates[0] : undefined,
        );
        const text = candidateText(candidate);
        if (text) yield { type: "text", text };
        if (candidate.finishReason) finish = mapFinish(candidate.finishReason);
        if (payload.usageMetadata) usage = readUsage(payload.usageMetadata);
      }
      if (usage) yield { type: "usage", usage };
      if (finish === null) {
        throw new AiProviderError(
          PROVIDER_ID,
          "network",
          `The ${provider.label} stream ended unexpectedly.`,
        );
      }
      yield { type: "finish", reason: finish };
    },

    async completeJson(json: JsonRequest): Promise<JsonResult> {
      const { system, contents } = toContents(json.messages);
      // `responseMimeType` is the long-standing, documented JSON mode. The schema travels in the
      // instruction and the caller's own validator is the contract, so no undocumented
      // schema field is sent.
      const instruction = `Respond with a single JSON object that matches this JSON Schema and nothing else:\n${JSON.stringify(json.schema)}`;
      const response = await call(
        json.apiKey,
        `/models/${encodeURIComponent(json.modelId)}:generateContent`,
        {
          timeoutMs: 120_000,
          signal: json.signal,
          body: {
            contents,
            systemInstruction: {
              parts: [{ text: [system, instruction].filter(Boolean).join("\n\n") }],
            },
            generationConfig: generationConfig(json, { responseMimeType: "application/json" }),
          },
        },
      );
      const payload = asRecord(await readJson(response, PROVIDER_ID, provider.label));
      assertNotBlocked(payload, provider.label);
      const candidate = asRecord(
        Array.isArray(payload.candidates) ? payload.candidates[0] : undefined,
      );
      return {
        json: parseJsonText(candidateText(candidate), PROVIDER_ID, provider.label),
        usage: readUsage(payload.usageMetadata),
        finishReason: mapFinish(candidate.finishReason),
      };
    },
  };
}
