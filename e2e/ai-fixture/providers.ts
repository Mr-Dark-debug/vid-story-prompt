// FAKE SERVER FUNCTIONS for the AI UI fixture. They hold state in memory and never contact a
// provider, Supabase or any network. Keys are validated by a trivial rule so tests can drive the
// success and rejection paths; no secret is ever echoed back or stored.
import type { AiModelGroup } from "../../src/services/ai/server";

const fixtureModels: AiModelGroup[] = [
  {
    credentialId: "6f1c0a54-0000-4000-8000-000000000001",
    providerId: "anthropic",
    label: "Personal",
    status: "active",
    fetchedAt: "2026-10-03T00:00:00Z",
    models: [
      {
        providerId: "anthropic",
        modelId: "claude-opus-5",
        displayName: "Claude Opus 5",
        family: "anthropic",
        contextWindow: 1_000_000,
        maxOutput: 128_000,
        supportsVision: true,
        supportsJsonSchema: true,
        supportsStreaming: true,
      },
    ],
  },
  {
    credentialId: "6f1c0a54-0000-4000-8000-000000000002",
    providerId: "openrouter",
    label: "Router",
    status: "active",
    fetchedAt: "2026-10-03T00:00:00Z",
    models: [
      {
        providerId: "openrouter",
        modelId: "meta-llama/llama-3.3-70b-instruct",
        displayName: "Meta: Llama 3.3 70B Instruct",
        family: "meta",
        contextWindow: 131_072,
        maxOutput: 8_192,
        supportsVision: false,
        supportsJsonSchema: true,
        supportsStreaming: true,
        pricing: { inputPerMillion: 0.1, outputPerMillion: 0.3 },
      },
    ],
  },
];

export const listAiModels = async () => fixtureModels;
export const getAiPreferences = async () => [];
export const updateChatThread = async () => ({ ok: true as const });
export const cancelChatMessage = async ({ data }: { data: { messageId: string } }) => {
  (window as unknown as { __stopCalls?: string[] }).__stopCalls ??= [];
  (window as unknown as { __stopCalls: string[] }).__stopCalls.push(data.messageId);
  return { cancelled: true };
};
export const setAiPreference = async () => ({ ok: true as const });

export const connectAiProvider = async ({
  data,
}: {
  data: { providerId: string; label: string; apiKey: string };
}) => {
  await new Promise((resolve) => setTimeout(resolve, 150));
  if (data.apiKey.includes("rejected")) {
    throw new Error("Anthropic rejected this key. Check that you copied it completely.");
  }
  // Report only non-secret facts, as the real service does.
  window.dispatchEvent(
    new CustomEvent("fixture:connected", {
      detail: { providerId: data.providerId, label: data.label, last4: data.apiKey.slice(-4) },
    }),
  );
  return { id: "new-connection", modelCount: 2 };
};
export const replaceAiProviderKey = async () => ({ id: "x", modelCount: 2 });
export const refreshAiModels = async () => ({ refreshed: true as const, modelCount: 2 });
export const revalidateAiProvider = async () => ({ status: "active" as const });
export const revokeAiProvider = async () => ({ ok: true as const });
export const deleteAiProvider = async () => ({ ok: true as const });
export const enqueueSocialCopyRuns = async () => ({ runs: [] });
export const cancelAiRun = async () => ({ cancelled: true });
