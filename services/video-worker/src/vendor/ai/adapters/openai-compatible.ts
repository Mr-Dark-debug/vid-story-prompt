// GENERATED from src/domain/ai by scripts/sync-worker-ai.mjs. Do not edit; run `npm run ai:sync`.
import { AiProviderError } from "../errors.js";
import { familyFromModel } from "../families.js";
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
  AiProviderDefinition,
  ChatDelta,
  ChatMessageInput,
  ChatRequest,
  FinishReason,
  JsonRequest,
  JsonResult,
  KeyValidation,
  ModelPricing,
  NormalizedModel,
  ProviderAdapter,
  TokenUsage,
} from "../types.js";

const DEFAULT_MAX_OUTPUT = 4_096;

/**
 * OpenAI's list includes embeddings, speech, image and moderation models. Only ids that look like
 * chat/responses models are kept; this is the small override table the spec asks for.
 */
const OPENAI_CHAT_ID = /^(gpt-|chatgpt-|o\d)/;
const OPENAI_NON_CHAT =
  /(embedding|whisper|tts|dall-e|moderation|transcribe|realtime|audio|image|search-preview|instruct|computer-use|deep-research|davinci|babbage)/;
const OPENAI_VISION = /^(gpt-4o|gpt-4\.1|gpt-4-turbo|gpt-5|chatgpt-4o|o1$|o1-20|o3|o4)/;
const OPENAI_JSON = /^(gpt-4o|gpt-4\.1|gpt-5|o1$|o1-20|o3|o4|gpt-4-turbo)/;
/** Reasoning-style models reject custom sampling temperature. */
const OPENAI_FIXED_TEMPERATURE = /^(o\d|gpt-5)/;
/** Facts confirmed from OpenAI documentation; everything else stays unknown rather than guessed. */
const OPENAI_LIMITS: ReadonlyArray<readonly [RegExp, number, number]> = [
  [/^gpt-4o(-mini)?(-\d{4}-\d{2}-\d{2})?$/, 128_000, 16_384],
  [/^gpt-4\.1(-mini|-nano)?(-\d{4}-\d{2}-\d{2})?$/, 1_047_576, 32_768],
];

const GENERIC_NON_CHAT =
  /(whisper|tts|embed|moderation|guard|rerank|playai|speech|transcrib|image|dall-e|flux|stable-diffusion|vision-preview)/i;

function toIso(seconds: unknown): string | undefined {
  const value = asNumber(seconds);
  return value && value > 0 ? new Date(value * 1_000).toISOString() : undefined;
}

/** OpenRouter prices are USD-per-token strings; convert to USD per million tokens. */
function perMillion(value: unknown): number | null {
  const parsed = typeof value === "string" ? Number(value) : asNumber(value);
  if (parsed === null || !Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 1_000_000 * 1_000) / 1_000;
}

export function normalizeOpenAiCompatibleModels(
  provider: AiProviderDefinition,
  entries: unknown[],
): NormalizedModel[] {
  const models: NormalizedModel[] = [];
  for (const entry of entries) {
    const record = asRecord(entry);
    const modelId = asString(record.id);
    if (!modelId) continue;

    if (provider.id === "openai") {
      if (!OPENAI_CHAT_ID.test(modelId) || OPENAI_NON_CHAT.test(modelId)) continue;
      const limits = OPENAI_LIMITS.find(([pattern]) => pattern.test(modelId));
      models.push({
        providerId: provider.id,
        modelId,
        displayName: modelId,
        family: "openai",
        contextWindow: limits?.[1] ?? null,
        maxOutput: limits?.[2] ?? null,
        supportsVision: OPENAI_VISION.test(modelId),
        supportsJsonSchema: OPENAI_JSON.test(modelId),
        supportsStreaming: true,
        createdAt: toIso(record.created),
      });
      continue;
    }

    if (provider.id === "openrouter") {
      const architecture = asRecord(record.architecture);
      const output = Array.isArray(architecture.output_modalities)
        ? architecture.output_modalities
        : ["text"];
      if (!output.includes("text")) continue;
      const input = Array.isArray(architecture.input_modalities)
        ? architecture.input_modalities
        : [];
      const supported = Array.isArray(record.supported_parameters)
        ? record.supported_parameters
        : [];
      const pricing = asRecord(record.pricing);
      const price: ModelPricing = {
        inputPerMillion: perMillion(pricing.prompt),
        outputPerMillion: perMillion(pricing.completion),
      };
      models.push({
        providerId: provider.id,
        modelId,
        displayName: asString(record.name) ?? modelId,
        family: familyFromModel(provider.id, modelId),
        contextWindow: asNumber(record.context_length),
        maxOutput: asNumber(asRecord(record.top_provider).max_completion_tokens),
        supportsVision: input.includes("image"),
        supportsJsonSchema:
          supported.includes("structured_outputs") || supported.includes("response_format"),
        supportsStreaming: true,
        pricing:
          price.inputPerMillion === null && price.outputPerMillion === null ? undefined : price,
        createdAt: toIso(record.created),
      });
      continue;
    }

    if (GENERIC_NON_CHAT.test(modelId)) continue;
    const type = asString(record.type);
    if (type && !["chat", "language", "model"].includes(type)) continue;
    if (record.active === false) continue;
    models.push({
      providerId: provider.id,
      modelId,
      displayName: asString(record.display_name) ?? modelId,
      family: familyFromModel(provider.id, modelId),
      contextWindow: asNumber(record.context_window) ?? asNumber(record.context_length),
      maxOutput: asNumber(record.max_completion_tokens),
      supportsVision: false,
      supportsJsonSchema: provider.capabilities.structuredOutput,
      supportsStreaming: true,
      createdAt: toIso(record.created),
    });
  }
  return models;
}

function mapFinish(reason: unknown): FinishReason {
  switch (reason) {
    case "stop":
      return "stop";
    case "length":
      return "length";
    case "content_filter":
      return "content_filter";
    default:
      return "other";
  }
}

function readUsage(value: unknown): TokenUsage {
  const usage = asRecord(value);
  return {
    inputTokens: asNumber(usage.prompt_tokens),
    outputTokens: asNumber(usage.completion_tokens),
  };
}

function streamErrorCode(raw: unknown) {
  const error = asRecord(raw);
  const code = asNumber(error.code);
  if (code === 401) return "invalid_key" as const;
  if (code === 402) return "quota_exceeded" as const;
  if (code === 403) return "forbidden" as const;
  if (code === 429) return "rate_limited" as const;
  if (code !== null && code >= 500) return "provider_unavailable" as const;
  return "bad_request" as const;
}

export function createOpenAiCompatibleAdapter(
  providerId: string,
  deps: AdapterDeps = {},
): ProviderAdapter {
  const provider = requireAiProvider(providerId);
  const dialect = provider.dialect;
  if (!dialect || (provider.kind !== "openai" && provider.kind !== "openai_compatible")) {
    throw new Error(`Provider ${providerId} is not OpenAI-compatible.`);
  }

  const call = (
    apiKey: string,
    path: string,
    init: { body?: unknown; signal?: AbortSignal; timeoutMs?: number } = {},
  ) =>
    providerFetch({
      providerId,
      providerLabel: provider.label,
      url: `${provider.baseUrl}${path}`,
      headers: { authorization: `Bearer ${apiKey}` },
      secrets: [apiKey],
      fetcher: deps.fetch,
      ...init,
    });

  const limitField = (max: number | undefined) => ({
    [dialect.maxTokensParam]: max ?? DEFAULT_MAX_OUTPUT,
  });
  const temperatureField = (modelId: string, temperature: number | undefined) =>
    temperature === undefined ||
    (provider.id === "openai" && OPENAI_FIXED_TEMPERATURE.test(modelId))
      ? {}
      : { temperature };
  const toWire = (messages: ChatMessageInput[]) =>
    messages.map((message) => ({ role: message.role, content: message.content }));

  return {
    providerId,

    async validateKey(apiKey, signal): Promise<KeyValidation> {
      try {
        const response = await call(apiKey, dialect.validationPath, { signal, timeoutMs: 15_000 });
        if (provider.id === "openrouter") {
          const data = asRecord(
            asRecord(await readJson(response, providerId, provider.label)).data,
          );
          if (data.disabled === true) return { ok: false, reason: "forbidden" };
        }
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
      const query = dialect.modelsQuery ? `?${dialect.modelsQuery}` : "";
      const response = await call(apiKey, `${dialect.modelsPath}${query}`, { signal });
      const payload = await readJson(response, providerId, provider.label);
      // Together returns a bare array; everyone else wraps it in `data`.
      const entries = Array.isArray(payload) ? payload : asRecord(payload).data;
      return normalizeOpenAiCompatibleModels(provider, Array.isArray(entries) ? entries : []);
    },

    async *streamChat(chat: ChatRequest): AsyncGenerator<ChatDelta> {
      const response = await call(chat.apiKey, "/chat/completions", {
        timeoutMs: 120_000,
        signal: chat.signal,
        body: {
          model: chat.modelId,
          messages: toWire(chat.messages),
          stream: true,
          ...(dialect.streamUsageOption ? { stream_options: { include_usage: true } } : {}),
          ...limitField(chat.maxOutputTokens),
          ...temperatureField(chat.modelId, chat.temperature),
        },
      });
      let finish: FinishReason | null = null;
      let done = false;
      for await (const event of readSse(response, {
        providerId,
        providerLabel: provider.label,
        signal: chat.signal,
        secrets: [chat.apiKey],
      })) {
        if (event.data === "[DONE]") {
          done = true;
          break;
        }
        const payload = asRecord(parseSseJson(event.data, providerId, provider.label));
        if (payload.error) {
          throw new AiProviderError(
            providerId,
            streamErrorCode(payload.error),
            `${provider.label} reported an error during the stream.`,
          );
        }
        const choice = asRecord(Array.isArray(payload.choices) ? payload.choices[0] : undefined);
        const content = asRecord(choice.delta).content;
        if (typeof content === "string" && content) yield { type: "text", text: content };
        if (choice.finish_reason) finish = mapFinish(choice.finish_reason);
        if (payload.usage) yield { type: "usage", usage: readUsage(payload.usage) };
      }
      if (finish === null && !done) {
        throw new AiProviderError(
          providerId,
          "network",
          `The ${provider.label} stream ended unexpectedly.`,
        );
      }
      yield { type: "finish", reason: finish ?? "stop" };
    },

    async completeJson(json: JsonRequest): Promise<JsonResult> {
      const messages = toWire(json.messages);
      const common = {
        model: json.modelId,
        ...limitField(json.maxOutputTokens ?? 8_192),
        ...temperatureField(json.modelId, json.temperature),
      };
      let response: Response;
      try {
        response = await call(json.apiKey, "/chat/completions", {
          timeoutMs: 120_000,
          signal: json.signal,
          body: {
            ...common,
            messages,
            response_format: {
              type: "json_schema",
              json_schema: {
                name: json.schemaName,
                strict: json.strict ?? true,
                schema: json.schema,
              },
            },
          },
        });
      } catch (error) {
        // Hosts or models without schema support: ask for a plain JSON object instead, once.
        if (!(error instanceof AiProviderError) || error.code !== "bad_request") throw error;
        response = await call(json.apiKey, "/chat/completions", {
          timeoutMs: 120_000,
          signal: json.signal,
          body: {
            ...common,
            messages: [
              {
                role: "system",
                content: `Respond with a single JSON object that matches this JSON Schema and nothing else:\n${JSON.stringify(json.schema)}`,
              },
              ...messages,
            ],
            response_format: { type: "json_object" },
          },
        });
      }
      const payload = asRecord(await readJson(response, providerId, provider.label));
      const choice = asRecord(Array.isArray(payload.choices) ? payload.choices[0] : undefined);
      const content = asRecord(choice.message).content;
      if (typeof content !== "string") {
        throw new AiProviderError(
          providerId,
          "invalid_response",
          `${provider.label} returned no content.`,
        );
      }
      return {
        json: parseJsonText(content, providerId, provider.label),
        usage: readUsage(payload.usage),
        finishReason: mapFinish(choice.finish_reason),
      };
    },
  };
}
