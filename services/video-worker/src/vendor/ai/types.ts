// GENERATED from src/domain/ai by scripts/sync-worker-ai.mjs. Do not edit; run `npm run ai:sync`.
// Pure, dependency-free types shared by the web app and the video worker.
// The worker consumes a generated copy of this folder (see scripts/sync-worker-ai.mjs),
// so every import here must be relative and use the `.js` extension.

export const AI_PROVIDER_KINDS = ["anthropic", "openai", "google", "openai_compatible"] as const;
export type AiProviderKind = (typeof AI_PROVIDER_KINDS)[number];

export const AI_AVAILABILITIES = ["available", "beta", "coming_soon"] as const;
export type AiAvailability = (typeof AI_AVAILABILITIES)[number];

export const AI_PURPOSES = ["chat", "clip_planning", "social_copy", "editor_plan"] as const;
export type AiPurpose = (typeof AI_PURPOSES)[number];

export type AiProviderCapabilities = {
  listModels: boolean;
  structuredOutput: boolean;
  streaming: boolean;
  vision: boolean;
};

/** Request-shape differences between OpenAI-compatible endpoints. */
export type OpenAiDialect = {
  /** OpenAI's newer models reject `max_tokens`; most compatible hosts still expect it. */
  maxTokensParam: "max_completion_tokens" | "max_tokens";
  /** Whether `stream_options.include_usage` is accepted. */
  streamUsageOption: boolean;
  /** Path (relative to baseUrl) used to prove a key works without relying on a public listing. */
  validationPath: string;
  modelsPath: string;
  /** Extra query string appended to the models listing. */
  modelsQuery?: string;
};

export type AiProviderDefinition = {
  id: string;
  label: string;
  kind: AiProviderKind;
  /** Fixed, https-only endpoint. Never derived from user input. */
  baseUrl: string;
  keyHelpUrl: string;
  keyPrefixHint: string;
  /** Asset key for the provider badge (see families.ts). */
  logoKey: string;
  capabilities: AiProviderCapabilities;
  availability: AiAvailability;
  description: string;
  dialect?: OpenAiDialect;
};

export type FinishReason = "stop" | "length" | "content_filter" | "other";

export type TokenUsage = { inputTokens: number | null; outputTokens: number | null };

export type ModelPricing = {
  /** USD per one million input tokens, only when the provider publishes it. */
  inputPerMillion: number | null;
  outputPerMillion: number | null;
};

export type NormalizedModel = {
  providerId: string;
  modelId: string;
  displayName: string;
  /** Model-maker family used for the logo (e.g. `anthropic`, `meta`). */
  family: string;
  contextWindow: number | null;
  maxOutput: number | null;
  /** True only when provider metadata or a verified override says so. */
  supportsVision: boolean;
  supportsJsonSchema: boolean;
  supportsStreaming: boolean;
  pricing?: ModelPricing;
  createdAt?: string;
};

export type ChatRole = "system" | "user" | "assistant";
export type ChatMessageInput = { role: ChatRole; content: string };

export type ChatDelta =
  | { type: "text"; text: string }
  | { type: "usage"; usage: TokenUsage }
  | { type: "finish"; reason: FinishReason };

export type ChatRequest = {
  apiKey: string;
  modelId: string;
  messages: ChatMessageInput[];
  maxOutputTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
};

export type JsonRequest = {
  apiKey: string;
  modelId: string;
  messages: ChatMessageInput[];
  schemaName: string;
  /** Plain JSON Schema. Callers must still validate the result with their own Zod schema. */
  schema: Record<string, unknown>;
  strict?: boolean;
  maxOutputTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
};

export type JsonResult = { json: unknown; usage: TokenUsage; finishReason: FinishReason };

export type KeyValidation =
  | { ok: true }
  | { ok: false; reason: "invalid" | "forbidden" | "rate_limited" | "network" };

export interface ProviderAdapter {
  readonly providerId: string;
  validateKey(apiKey: string, signal?: AbortSignal): Promise<KeyValidation>;
  listModels(apiKey: string, signal?: AbortSignal): Promise<NormalizedModel[]>;
  streamChat(request: ChatRequest): AsyncIterable<ChatDelta>;
  completeJson(request: JsonRequest): Promise<JsonResult>;
}

export type AdapterDeps = { fetch?: typeof fetch };
