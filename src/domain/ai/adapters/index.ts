import { requireAiProvider } from "../providers.js";
import type { AdapterDeps, ProviderAdapter } from "../types.js";
import { createAnthropicAdapter } from "./anthropic.js";
import { createGoogleAdapter } from "./google.js";
import { createOpenAiCompatibleAdapter } from "./openai-compatible.js";

/** Returns the adapter for a registry provider. Unknown ids throw; base URLs are never caller-supplied. */
export function getAdapter(providerId: string, deps: AdapterDeps = {}): ProviderAdapter {
  const provider = requireAiProvider(providerId);
  switch (provider.kind) {
    case "anthropic":
      return createAnthropicAdapter(deps);
    case "google":
      return createGoogleAdapter(deps);
    case "openai":
    case "openai_compatible":
      return createOpenAiCompatibleAdapter(provider.id, deps);
  }
}
