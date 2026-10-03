// Single source of truth for supported AI providers. UI, server code and the worker read this
// registry; none of them keep their own provider lists. It contains no secrets.
//
// Availability follows the same honesty rules as connectors: `available` has a verified execution
// path, `beta` is implemented against a documented OpenAI-compatible endpoint but has not been
// exercised with live keys by Vidrial, `coming_soon` is non-executable.
//
// A user-supplied "custom" base URL is intentionally NOT offered. It would need the DNS/IP/
// redirect/size controls from the worker's direct-download guard before any request could be made.

import type { AiAvailability, AiProviderDefinition, AiPurpose } from "./types.js";
import { AI_PURPOSES } from "./types.js";

const OPENAI_DIALECT = {
  maxTokensParam: "max_completion_tokens",
  streamUsageOption: true,
  validationPath: "/models",
  modelsPath: "/models",
} as const;

const COMPATIBLE_DIALECT = {
  maxTokensParam: "max_tokens",
  streamUsageOption: true,
  validationPath: "/models",
  modelsPath: "/models",
} as const;

const fullCapabilities = {
  listModels: true,
  structuredOutput: true,
  streaming: true,
  vision: true,
} as const;

const textCapabilities = {
  listModels: true,
  structuredOutput: false,
  streaming: true,
  vision: false,
} as const;

const PROVIDER_LIST: AiProviderDefinition[] = [
  {
    id: "anthropic",
    label: "Anthropic",
    kind: "anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    keyHelpUrl: "https://console.anthropic.com/settings/keys",
    keyPrefixHint: "sk-ant-",
    logoKey: "claude",
    capabilities: fullCapabilities,
    availability: "available",
    description: "Claude models through your Anthropic API key.",
  },
  {
    id: "openai",
    label: "OpenAI",
    kind: "openai",
    baseUrl: "https://api.openai.com/v1",
    keyHelpUrl: "https://platform.openai.com/api-keys",
    keyPrefixHint: "sk-",
    logoKey: "openai",
    capabilities: fullCapabilities,
    availability: "available",
    description: "GPT models through your OpenAI API key.",
    dialect: OPENAI_DIALECT,
  },
  {
    id: "google",
    label: "Google Gemini",
    kind: "google",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    keyHelpUrl: "https://aistudio.google.com/apikey",
    keyPrefixHint: "AIza",
    logoKey: "gemini",
    capabilities: { ...fullCapabilities, structuredOutput: true },
    availability: "available",
    description: "Gemini models through a Google AI Studio key.",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    kind: "openai_compatible",
    baseUrl: "https://openrouter.ai/api/v1",
    keyHelpUrl: "https://openrouter.ai/keys",
    keyPrefixHint: "sk-or-",
    logoKey: "openrouter",
    capabilities: fullCapabilities,
    availability: "available",
    description: "Hundreds of models from many makers behind one key.",
    dialect: {
      ...COMPATIBLE_DIALECT,
      validationPath: "/key",
      modelsQuery: "output_modalities=text",
    },
  },
  {
    id: "groq",
    label: "Groq",
    kind: "openai_compatible",
    baseUrl: "https://api.groq.com/openai/v1",
    keyHelpUrl: "https://console.groq.com/keys",
    keyPrefixHint: "gsk_",
    logoKey: "groq",
    capabilities: { ...textCapabilities, structuredOutput: true },
    availability: "beta",
    description: "Fast open-weight models. Beta: not yet exercised with live keys by Vidrial.",
    dialect: COMPATIBLE_DIALECT,
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    kind: "openai_compatible",
    baseUrl: "https://api.deepseek.com",
    keyHelpUrl: "https://platform.deepseek.com/api_keys",
    keyPrefixHint: "sk-",
    logoKey: "deepseek",
    capabilities: textCapabilities,
    availability: "beta",
    description: "DeepSeek models. Beta: not yet exercised with live keys by Vidrial.",
    dialect: COMPATIBLE_DIALECT,
  },
  {
    id: "mistral",
    label: "Mistral AI",
    kind: "openai_compatible",
    baseUrl: "https://api.mistral.ai/v1",
    keyHelpUrl: "https://console.mistral.ai/api-keys",
    keyPrefixHint: "",
    logoKey: "mistral",
    capabilities: { ...textCapabilities, structuredOutput: true },
    availability: "beta",
    description: "Mistral models. Beta: not yet exercised with live keys by Vidrial.",
    dialect: COMPATIBLE_DIALECT,
  },
  {
    id: "xai",
    label: "xAI",
    kind: "openai_compatible",
    baseUrl: "https://api.x.ai/v1",
    keyHelpUrl: "https://console.x.ai",
    keyPrefixHint: "xai-",
    logoKey: "grok",
    capabilities: { ...textCapabilities, structuredOutput: true },
    availability: "beta",
    description: "Grok models. Beta: not yet exercised with live keys by Vidrial.",
    dialect: COMPATIBLE_DIALECT,
  },
  {
    id: "together",
    label: "Together AI",
    kind: "openai_compatible",
    baseUrl: "https://api.together.xyz/v1",
    keyHelpUrl: "https://api.together.ai/settings/api-keys",
    keyPrefixHint: "",
    logoKey: "together",
    capabilities: textCapabilities,
    availability: "beta",
    description: "Open-weight models. Beta: not yet exercised with live keys by Vidrial.",
    dialect: { ...COMPATIBLE_DIALECT },
  },
];

for (const provider of PROVIDER_LIST) {
  if (!provider.baseUrl.startsWith("https://")) {
    throw new Error(`AI provider ${provider.id} must use an https base URL.`);
  }
}

export const AI_PROVIDERS: readonly AiProviderDefinition[] = Object.freeze(PROVIDER_LIST);

const BY_ID = new Map(PROVIDER_LIST.map((provider) => [provider.id, provider]));

export const AI_PROVIDER_IDS: readonly string[] = Object.freeze(PROVIDER_LIST.map((p) => p.id));

export function getAiProvider(id: string): AiProviderDefinition | undefined {
  return BY_ID.get(id);
}

export function requireAiProvider(id: string): AiProviderDefinition {
  const provider = BY_ID.get(id);
  if (!provider) throw new Error(`Unknown AI provider: ${id}`);
  return provider;
}

export function isAiProviderId(id: unknown): id is string {
  return typeof id === "string" && BY_ID.has(id);
}

/** Providers a user may connect today (coming-soon entries are listed but never executable). */
export function isProviderConnectable(provider: AiProviderDefinition): boolean {
  return provider.availability === "available" || provider.availability === "beta";
}

export function listAiProviders(availability?: AiAvailability): AiProviderDefinition[] {
  return availability
    ? PROVIDER_LIST.filter((provider) => provider.availability === availability)
    : [...PROVIDER_LIST];
}

export function isAiPurpose(value: unknown): value is AiPurpose {
  return typeof value === "string" && (AI_PURPOSES as readonly string[]).includes(value);
}

export const AI_PURPOSE_LABELS: Readonly<Record<AiPurpose, string>> = Object.freeze({
  chat: "Chat",
  clip_planning: "Clip planning",
  social_copy: "Social copy",
  editor_plan: "Editor plan",
});
