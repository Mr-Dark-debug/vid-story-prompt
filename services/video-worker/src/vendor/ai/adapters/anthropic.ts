// GENERATED from src/domain/ai by scripts/sync-worker-ai.mjs. Do not edit; run `npm run ai:sync`.
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

const PROVIDER_ID = "anthropic";
const API_VERSION = "2023-06-01";
const DEFAULT_MAX_OUTPUT = 4_096;
const MAX_MODEL_PAGES = 5;

/** Anthropic's structured outputs reject numeric/string/array bounds; callers still validate. */
const UNSUPPORTED_SCHEMA_KEYWORDS = new Set([
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minLength",
  "maxLength",
  "maxItems",
]);

export function toAnthropicSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toAnthropicSchema);
  if (!schema || typeof schema !== "object") return schema;
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (UNSUPPORTED_SCHEMA_KEYWORDS.has(key)) continue;
    if (key === "minItems" && typeof value === "number" && value > 1) {
      output[key] = 1;
      continue;
    }
    output[key] = toAnthropicSchema(value);
  }
  if (output.type === "object" && output.additionalProperties === undefined) {
    output.additionalProperties = false;
  }
  return output;
}

function mapStopReason(reason: unknown): FinishReason {
  switch (reason) {
    case "end_turn":
    case "stop_sequence":
      return "stop";
    case "max_tokens":
    case "model_context_window_exceeded":
      return "length";
    case "refusal":
      return "content_filter";
    default:
      return "other";
  }
}

function splitMessages(messages: ChatMessageInput[]) {
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
  const turns: { role: "user" | "assistant"; content: string }[] = [];
  for (const message of messages) {
    if (message.role === "system") continue;
    const last = turns[turns.length - 1];
    // The API requires alternating roles; fold consecutive same-role turns together.
    if (last && last.role === message.role) last.content += `\n\n${message.content}`;
    else turns.push({ role: message.role, content: message.content });
  }
  return { system: system || undefined, turns };
}

function readUsage(value: unknown): TokenUsage {
  const usage = asRecord(value);
  return {
    inputTokens: asNumber(usage.input_tokens),
    outputTokens: asNumber(usage.output_tokens),
  };
}

export function createAnthropicAdapter(deps: AdapterDeps = {}): ProviderAdapter {
  const provider = requireAiProvider(PROVIDER_ID);
  const headers = (apiKey: string) => ({
    "x-api-key": apiKey,
    "anthropic-version": API_VERSION,
  });
  const call = (
    apiKey: string,
    path: string,
    init: { body?: unknown; signal?: AbortSignal; timeoutMs?: number } = {},
  ) =>
    providerFetch({
      providerId: PROVIDER_ID,
      providerLabel: provider.label,
      url: `${provider.baseUrl}${path}`,
      headers: headers(apiKey),
      secrets: [apiKey],
      fetcher: deps.fetch,
      ...init,
    });

  function normalize(entry: unknown): NormalizedModel | null {
    const record = asRecord(entry);
    const modelId = asString(record.id);
    if (!modelId) return null;
    const capabilities = asRecord(record.capabilities);
    const created = asString(record.created_at);
    return {
      providerId: PROVIDER_ID,
      modelId,
      displayName: asString(record.display_name) ?? modelId,
      family: "anthropic",
      contextWindow: asNumber(record.max_input_tokens),
      maxOutput: asNumber(record.max_tokens),
      supportsVision: asRecord(capabilities.image_input).supported === true,
      supportsJsonSchema: asRecord(capabilities.structured_outputs).supported === true,
      supportsStreaming: true,
      // An epoch value means the release date is unknown.
      createdAt: created && !created.startsWith("1970") ? created : undefined,
    };
  }

  async function request(body: Record<string, unknown>, apiKey: string, signal?: AbortSignal) {
    return call(apiKey, "/messages", { body, signal, timeoutMs: 120_000 });
  }

  return {
    providerId: PROVIDER_ID,

    async validateKey(apiKey, signal): Promise<KeyValidation> {
      try {
        await call(apiKey, "/models?limit=1", { signal, timeoutMs: 15_000 });
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
      let afterId: string | null = null;
      for (let page = 0; page < MAX_MODEL_PAGES; page++) {
        const query: string = `limit=1000${afterId ? `&after_id=${encodeURIComponent(afterId)}` : ""}`;
        const response = await call(apiKey, `/models?${query}`, { signal });
        const payload = asRecord(await readJson(response, PROVIDER_ID, provider.label));
        const data = Array.isArray(payload.data) ? payload.data : [];
        for (const entry of data) {
          const model = normalize(entry);
          if (model) models.push(model);
        }
        afterId = payload.has_more === true ? asString(payload.last_id) : null;
        if (!afterId) break;
      }
      return models;
    },

    async *streamChat(chat: ChatRequest): AsyncGenerator<ChatDelta> {
      const { system, turns } = splitMessages(chat.messages);
      const response = await request(
        {
          model: chat.modelId,
          max_tokens: chat.maxOutputTokens ?? DEFAULT_MAX_OUTPUT,
          stream: true,
          ...(system ? { system } : {}),
          ...(chat.temperature === undefined ? {} : { temperature: chat.temperature }),
          messages: turns,
        },
        chat.apiKey,
        chat.signal,
      );
      let inputTokens: number | null = null;
      let finish: FinishReason | null = null;
      for await (const event of readSse(response, {
        providerId: PROVIDER_ID,
        providerLabel: provider.label,
        signal: chat.signal,
        secrets: [chat.apiKey],
      })) {
        const payload = asRecord(parseSseJson(event.data, PROVIDER_ID, provider.label));
        switch (payload.type) {
          case "message_start":
            inputTokens = readUsage(asRecord(payload.message).usage).inputTokens;
            break;
          case "content_block_delta": {
            const delta = asRecord(payload.delta);
            if (delta.type === "text_delta" && typeof delta.text === "string" && delta.text) {
              yield { type: "text", text: delta.text };
            }
            break;
          }
          case "message_delta": {
            const usage = readUsage(payload.usage);
            yield {
              type: "usage",
              usage: {
                inputTokens: usage.inputTokens ?? inputTokens,
                outputTokens: usage.outputTokens,
              },
            };
            finish = mapStopReason(asRecord(payload.delta).stop_reason);
            break;
          }
          case "error": {
            const error = asRecord(payload.error);
            const kind = asString(error.type);
            const code =
              kind === "overloaded_error" || kind === "api_error"
                ? "provider_unavailable"
                : kind === "rate_limit_error"
                  ? "rate_limited"
                  : kind === "authentication_error"
                    ? "invalid_key"
                    : kind === "permission_error"
                      ? "forbidden"
                      : "bad_request";
            throw new AiProviderError(
              PROVIDER_ID,
              code,
              `${provider.label} reported a stream error (${kind ?? "unknown"}).`,
            );
          }
          default:
            break;
        }
      }
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
      const { system, turns } = splitMessages(json.messages);
      const schemaInstruction = `Respond with a single JSON object that matches this JSON Schema and nothing else:\n${JSON.stringify(json.schema)}`;
      const base = {
        model: json.modelId,
        max_tokens: json.maxOutputTokens ?? 8_192,
        ...(json.temperature === undefined ? {} : { temperature: json.temperature }),
        messages: turns,
      };
      let response: Response;
      try {
        response = await request(
          {
            ...base,
            ...(system ? { system } : {}),
            output_config: {
              format: { type: "json_schema", schema: toAnthropicSchema(json.schema) },
            },
          },
          json.apiKey,
          json.signal,
        );
      } catch (error) {
        // Older models reject structured outputs; fall back to a prompt-embedded schema once.
        if (!(error instanceof AiProviderError) || error.code !== "bad_request") throw error;
        response = await request(
          { ...base, system: [system, schemaInstruction].filter(Boolean).join("\n\n") },
          json.apiKey,
          json.signal,
        );
      }
      const payload = asRecord(await readJson(response, PROVIDER_ID, provider.label));
      const text = (Array.isArray(payload.content) ? payload.content : [])
        .map((block) => asRecord(block))
        .filter((block) => block.type === "text" && typeof block.text === "string")
        .map((block) => block.text as string)
        .join("");
      return {
        json: parseJsonText(text, PROVIDER_ID, provider.label),
        usage: readUsage(payload.usage),
        finishReason: mapStopReason(payload.stop_reason),
      };
    },
  };
}
