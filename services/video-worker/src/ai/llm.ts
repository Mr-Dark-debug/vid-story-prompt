import { getAdapter } from "../vendor/ai/adapters/index.js";
import type { AiProviderError } from "../vendor/ai/errors.js";
import type { CredentialSource } from "../vendor/ai/resolution.js";
import type { TokenUsage } from "../vendor/ai/types.js";

/** One resolved way to call a model for a worker job. Holds the key only in memory. */
export type LlmHandle = {
  source: Exclude<CredentialSource, "deterministic">;
  providerId: string;
  modelId: string;
  credentialId: string | null;
  complete(request: {
    system: string;
    user: string;
    schemaName: string;
    schema: Record<string, unknown>;
    temperature?: number;
    signal?: AbortSignal;
  }): Promise<{ json: unknown; usage: TokenUsage }>;
  /** Invoked when the provider proves the key unusable, so the credential can be flagged. */
  onRejected?: (error: AiProviderError) => Promise<void>;
};

export function createLlmHandle(options: {
  source: LlmHandle["source"];
  providerId: string;
  modelId: string;
  credentialId: string | null;
  apiKey: string;
  fetcher?: typeof fetch;
  onRejected?: LlmHandle["onRejected"];
}): LlmHandle {
  const adapter = getAdapter(options.providerId, { fetch: options.fetcher });
  return {
    source: options.source,
    providerId: options.providerId,
    modelId: options.modelId,
    credentialId: options.credentialId,
    onRejected: options.onRejected,
    async complete(request) {
      const { json, usage } = await adapter.completeJson({
        apiKey: options.apiKey,
        modelId: options.modelId,
        messages: [
          { role: "system", content: request.system },
          { role: "user", content: request.user },
        ],
        schemaName: request.schemaName,
        schema: request.schema,
        strict: true,
        temperature: request.temperature,
        signal: request.signal,
      });
      return { json, usage };
    },
  };
}

export function addUsage(total: TokenUsage, next: TokenUsage): TokenUsage {
  const sum = (a: number | null, b: number | null) => (a === null && b === null ? null : (a ?? 0) + (b ?? 0));
  return {
    inputTokens: sum(total.inputTokens, next.inputTokens),
    outputTokens: sum(total.outputTokens, next.outputTokens),
  };
}
