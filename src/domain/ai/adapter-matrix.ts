// Test-only: one adapter per provider kind with a distinctive fake key (excluded from the worker copy).
import { createAnthropicAdapter } from "./adapters/anthropic";
import { createGoogleAdapter } from "./adapters/google";
import { createOpenAiCompatibleAdapter } from "./adapters/openai-compatible";
import type { ProviderAdapter } from "./types";

export function createAdapterMatrix(): Record<
  string,
  { secret: string; make: (fetcher: typeof fetch) => ProviderAdapter }
> {
  return {
    anthropic: {
      secret: "sk-ant-api03-LEAKCHECKLEAKCHECK01",
      make: (fetch) => createAnthropicAdapter({ fetch }),
    },
    openai: {
      secret: "sk-proj-LEAKCHECKLEAKCHECK0002",
      make: (fetch) => createOpenAiCompatibleAdapter("openai", { fetch }),
    },
    google: {
      secret: "AIzaSyLEAKCHECKLEAKCHECK0000003",
      make: (fetch) => createGoogleAdapter({ fetch }),
    },
    openrouter: {
      secret: "sk-or-v1-LEAKCHECKLEAKCHECK0004",
      make: (fetch) => createOpenAiCompatibleAdapter("openrouter", { fetch }),
    },
    groq: {
      secret: "gsk_LEAKCHECKLEAKCHECKLEAKCHECK05",
      make: (fetch) => createOpenAiCompatibleAdapter("groq", { fetch }),
    },
  };
}
