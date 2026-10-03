// GENERATED from src/domain/ai by scripts/sync-worker-ai.mjs. Do not edit; run `npm run ai:sync`.
// Model-maker families. A model's logo follows its maker, not the host that serves it, so an
// OpenRouter-hosted Claude shows the Anthropic mark with an OpenRouter provider badge.

export type AiFamily = {
  id: string;
  label: string;
  /** File name (without extension) under src/assets/ai-providers. */
  logoKey: string;
};

const FAMILY_LIST: AiFamily[] = [
  { id: "openai", label: "OpenAI", logoKey: "openai" },
  { id: "anthropic", label: "Anthropic", logoKey: "claude" },
  { id: "google", label: "Google", logoKey: "gemini" },
  { id: "meta", label: "Meta", logoKey: "meta" },
  { id: "mistral", label: "Mistral AI", logoKey: "mistral" },
  { id: "deepseek", label: "DeepSeek", logoKey: "deepseek" },
  { id: "xai", label: "xAI", logoKey: "grok" },
  { id: "qwen", label: "Qwen", logoKey: "qwen" },
  { id: "perplexity", label: "Perplexity", logoKey: "perplexity" },
  { id: "groq", label: "Groq", logoKey: "groq" },
  { id: "together", label: "Together AI", logoKey: "together" },
  { id: "openrouter", label: "OpenRouter", logoKey: "openrouter" },
  { id: "generic", label: "Other", logoKey: "generic" },
];

export const AI_FAMILIES: Readonly<Record<string, AiFamily>> = Object.freeze(
  Object.fromEntries(FAMILY_LIST.map((family) => [family.id, family])),
);

export const GENERIC_FAMILY_ID = "generic";

export function getFamily(id: string | null | undefined): AiFamily {
  return (id && AI_FAMILIES[id]) || AI_FAMILIES[GENERIC_FAMILY_ID];
}

/** OpenRouter model ids are `author/model`; map the author slug to a family. */
const AUTHOR_PREFIXES: Readonly<Record<string, string>> = {
  openai: "openai",
  anthropic: "anthropic",
  google: "google",
  "meta-llama": "meta",
  meta: "meta",
  mistralai: "mistral",
  mistral: "mistral",
  deepseek: "deepseek",
  "x-ai": "xai",
  xai: "xai",
  qwen: "qwen",
  perplexity: "perplexity",
};

const MODEL_NAME_HINTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/(^|[/_-])(gpt|o\d|chatgpt)([-_.\d]|$)/i, "openai"],
  [/claude/i, "anthropic"],
  [/gemini|gemma/i, "google"],
  [/llama/i, "meta"],
  [/mistral|mixtral|codestral|ministral|pixtral/i, "mistral"],
  [/deepseek/i, "deepseek"],
  [/grok/i, "xai"],
  [/qwen|qwq/i, "qwen"],
  [/sonar/i, "perplexity"],
];

/** Providers that are themselves a model maker; their un-prefixed models use that family. */
const MAKER_PROVIDERS: Readonly<Record<string, string>> = {
  openai: "openai",
  anthropic: "anthropic",
  google: "google",
  xai: "xai",
  mistral: "mistral",
  deepseek: "deepseek",
};

export function familyFromModel(providerId: string, modelId: string): string {
  const slash = modelId.indexOf("/");
  if (slash > 0) {
    const mapped = AUTHOR_PREFIXES[modelId.slice(0, slash).toLowerCase()];
    if (mapped) return mapped;
  }
  const own = MAKER_PROVIDERS[providerId];
  if (own) return own;
  for (const [pattern, family] of MODEL_NAME_HINTS) {
    if (pattern.test(modelId)) return family;
  }
  return GENERIC_FAMILY_ID;
}
