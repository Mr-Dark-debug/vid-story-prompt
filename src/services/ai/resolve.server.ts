// Credential resolution for interactive server work (editor plans, clip-copy regeneration).
// Applies the same order as the worker: explicit -> user default -> platform -> unavailable.
// There is no deterministic fallback here: these features need a model to do anything.
import { getAdapter } from "@/domain/ai/adapters";
import { isAiProviderError, userMessageForAiError } from "@/domain/ai/errors";
import { getAiProvider } from "@/domain/ai/providers";
import {
  resolveAiModel,
  type CredentialSnapshot,
  type ModelSelection,
  type Resolution,
} from "@/domain/ai/resolution";
import type { AdapterDeps, AiPurpose, TokenUsage } from "@/domain/ai/types";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { AiServiceError, type Actor, type CredentialService } from "./credential-service.server";

export interface ResolutionStore {
  preference(actor: Actor, purpose: AiPurpose): Promise<ModelSelection | null>;
  snapshots(actor: Actor, ids: string[]): Promise<Map<string, CredentialSnapshot>>;
}

export function createSupabaseResolutionStore(): ResolutionStore {
  const db = () => getSupabaseAdminClient();
  return {
    async preference(actor, purpose) {
      const { data, error } = await db()
        .from("ai_user_preferences")
        .select("credential_id,model_id")
        .eq("workspace_id", actor.workspaceId)
        .eq("user_id", actor.userId)
        .eq("purpose", purpose)
        .maybeSingle();
      if (error) throw new Error("AI model preference lookup failed.");
      return data ? { credentialId: data.credential_id, modelId: data.model_id } : null;
    },
    async snapshots(actor, ids) {
      const map = new Map<string, CredentialSnapshot>();
      if (ids.length === 0) return map;
      const { data, error } = await db()
        .from("ai_provider_credentials")
        .select("id,provider_id,status")
        .eq("workspace_id", actor.workspaceId)
        .eq("user_id", actor.userId)
        .in("id", ids);
      if (error) throw new Error("AI credential lookup failed.");
      for (const row of data ?? []) {
        map.set(row.id, {
          providerId: row.provider_id,
          status: row.status as CredentialSnapshot["status"],
        });
      }
      return map;
    },
  };
}

export type PlatformModel = { apiKey: string; modelId: string } | null;

export type ResolverDeps = {
  store: ResolutionStore;
  credentials: Pick<CredentialService, "resolveKey" | "markInvalid">;
  platform: () => PlatformModel;
  adapters?: AdapterDeps;
};

export type JsonRun = {
  json: unknown;
  usage: TokenUsage;
  source: "user_key" | "platform";
  providerId: string;
  modelId: string;
  credentialId: string | null;
  resolution: Resolution;
};

export function createModelResolver(deps: ResolverDeps) {
  async function run(input: {
    actor: Actor;
    purpose: AiPurpose;
    explicit?: ModelSelection | null;
    system: string;
    user: string;
    schemaName: string;
    schema: Record<string, unknown>;
    temperature?: number;
    signal?: AbortSignal;
  }): Promise<JsonRun> {
    const preference = await deps.store.preference(input.actor, input.purpose);
    const ids = [
      ...new Set(
        [input.explicit?.credentialId, preference?.credentialId].filter(Boolean) as string[],
      ),
    ];
    const platform = deps.platform();
    const resolution = resolveAiModel({
      purpose: input.purpose,
      explicit: input.explicit ?? null,
      preference,
      credentials: await deps.store.snapshots(input.actor, ids),
      platformAvailable: platform !== null,
    });

    let apiKey: string;
    let providerId: string;
    let modelId: string;
    let credentialId: string | null = null;
    let source: JsonRun["source"];
    if (resolution.source === "user_key") {
      const resolved = await deps.credentials.resolveKey({
        ...input.actor,
        credentialId: resolution.credentialId,
      });
      apiKey = resolved.apiKey;
      providerId = resolution.providerId;
      modelId = resolution.modelId;
      credentialId = resolution.credentialId;
      source = "user_key";
    } else if (resolution.source === "platform" && platform) {
      apiKey = platform.apiKey;
      providerId = "openrouter";
      modelId = platform.modelId;
      source = "platform";
    } else {
      throw new AiServiceError(
        "not_configured",
        resolution.skipped.length
          ? "Your selected AI key is not usable. Reconnect it in AI providers settings."
          : "No AI model is available. Connect a provider key in AI providers settings.",
      );
    }

    try {
      const { json, usage } = await getAdapter(providerId, deps.adapters).completeJson({
        apiKey,
        modelId,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user },
        ],
        schemaName: input.schemaName,
        schema: input.schema,
        strict: true,
        temperature: input.temperature,
        signal: input.signal,
      });
      return { json, usage, source, providerId, modelId, credentialId, resolution };
    } catch (error) {
      if (!isAiProviderError(error)) throw error;
      if (error.invalidatesCredential && credentialId) {
        await deps.credentials.markInvalid({ ...input.actor, credentialId, code: error.code });
      }
      const label = getAiProvider(providerId)?.label ?? providerId;
      throw new AiServiceError(
        error.invalidatesCredential
          ? "key_invalid"
          : error.code === "rate_limited"
            ? "rate_limited"
            : "network",
        userMessageForAiError(error.code, label),
        error.retryAfterSeconds,
      );
    }
  }
  return { run };
}

export type ModelResolver = ReturnType<typeof createModelResolver>;
