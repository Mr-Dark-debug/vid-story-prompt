import { env } from "../config/env.js";
import { supabase } from "../storage/client.js";
import {
  decryptCredential,
  parseCredentialKeyRing,
  type CredentialKeyRing,
} from "../vendor/ai/credential-crypto.js";
import type { AiProviderError } from "../vendor/ai/errors.js";
import {
  resolveAiModel,
  type CredentialSnapshot,
  type ModelSelection,
  type Resolution,
} from "../vendor/ai/resolution.js";
import type { AiPurpose } from "../vendor/ai/types.js";
import { createLlmHandle, type LlmHandle } from "./llm.js";

export type StoredCredential = {
  id: string;
  providerId: string;
  status: "active" | "invalid" | "revoked";
  keyEncrypted: string | null;
};

/** The only database surface the resolver needs; faked in tests. */
export interface AiCredentialRepository {
  preference(workspaceId: string, userId: string, purpose: AiPurpose): Promise<ModelSelection | null>;
  credentials(workspaceId: string, userId: string, ids: string[]): Promise<StoredCredential[]>;
  markInvalid(credentialId: string, code: string): Promise<void>;
}

export function createSupabaseCredentialRepository(): AiCredentialRepository {
  return {
    async preference(workspaceId, userId, purpose) {
      const { data, error } = await supabase
        .from("ai_user_preferences")
        .select("credential_id,model_id")
        .eq("workspace_id", workspaceId)
        .eq("user_id", userId)
        .eq("purpose", purpose)
        .maybeSingle();
      if (error) throw error;
      return data ? { credentialId: data.credential_id as string, modelId: data.model_id as string } : null;
    },
    async credentials(workspaceId, userId, ids) {
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("ai_provider_credentials")
        .select("id,provider_id,status,key_encrypted")
        .eq("workspace_id", workspaceId)
        .eq("user_id", userId)
        .in("id", ids);
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id as string,
        providerId: row.provider_id as string,
        status: row.status as StoredCredential["status"],
        keyEncrypted: (row.key_encrypted as string | null) ?? null,
      }));
    },
    async markInvalid(credentialId, code) {
      await supabase
        .from("ai_provider_credentials")
        .update({ status: "invalid", last_error_code: code.slice(0, 64) })
        .eq("id", credentialId)
        .eq("status", "active");
    },
  };
}

export type PlatformModel = { apiKey?: string; modelId?: string } | null;

export type ResolvedLlm = {
  llm: LlmHandle | null;
  resolution: Resolution;
  /** True when a user key exists but could not be decrypted on this worker. */
  decryptFailed: boolean;
};

function keyRingOrNull(): CredentialKeyRing | null {
  try {
    return parseCredentialKeyRing(env);
  } catch {
    return null;
  }
}

/**
 * Applies the shared resolution order (explicit -> default -> platform -> deterministic) and
 * returns a ready-to-use handle. Plaintext keys live only inside the returned closure.
 */
export async function resolveWorkerLlm(options: {
  workspaceId: string;
  userId: string;
  purpose: AiPurpose;
  explicit?: ModelSelection | null;
  repository?: AiCredentialRepository;
  platform?: PlatformModel;
  keyRing?: CredentialKeyRing | null;
  fetcher?: typeof fetch;
}): Promise<ResolvedLlm> {
  const repository = options.repository ?? createSupabaseCredentialRepository();
  const platform =
    options.platform === undefined
      ? env.OPENROUTER_API_KEY && env.OPENROUTER_CLIP_MODEL
        ? { apiKey: env.OPENROUTER_API_KEY, modelId: env.OPENROUTER_CLIP_MODEL }
        : null
      : options.platform;
  const platformAvailable = Boolean(platform?.apiKey && platform?.modelId);

  const preference = await repository.preference(options.workspaceId, options.userId, options.purpose);
  const ids = [...new Set([options.explicit?.credentialId, preference?.credentialId].filter(Boolean) as string[])];
  const stored = new Map(
    (await repository.credentials(options.workspaceId, options.userId, ids)).map((item) => [item.id, item]),
  );

  const keyRing = options.keyRing === undefined ? keyRingOrNull() : options.keyRing;
  let decryptFailed = false;
  const plaintext = new Map<string, string>();
  const snapshots = new Map<string, CredentialSnapshot>();
  for (const credential of stored.values()) {
    let status = credential.status;
    if (status === "active") {
      try {
        if (!keyRing || !credential.keyEncrypted) throw new Error("not decryptable");
        plaintext.set(
          credential.id,
          await decryptCredential(
            credential.keyEncrypted,
            { workspaceId: options.workspaceId, userId: options.userId, providerId: credential.providerId },
            keyRing,
          ),
        );
      } catch {
        // Unreadable on this worker (missing or rotated-away key): unusable, but not the provider's fault.
        decryptFailed = true;
        status = "invalid";
      }
    }
    snapshots.set(credential.id, { providerId: credential.providerId, status });
  }

  const resolution = resolveAiModel({
    purpose: options.purpose,
    explicit: options.explicit ?? null,
    preference,
    credentials: snapshots,
    platformAvailable,
  });

  if (resolution.source === "user_key") {
    return {
      decryptFailed,
      resolution,
      llm: createLlmHandle({
        source: "user_key",
        providerId: resolution.providerId,
        modelId: resolution.modelId,
        credentialId: resolution.credentialId,
        apiKey: plaintext.get(resolution.credentialId)!,
        fetcher: options.fetcher,
        onRejected: async (error: AiProviderError) => {
          await repository.markInvalid(resolution.credentialId, error.code);
        },
      }),
    };
  }
  if (resolution.source === "platform" && platform?.apiKey && platform.modelId) {
    return {
      decryptFailed,
      resolution,
      llm: createLlmHandle({
        source: "platform",
        providerId: "openrouter",
        modelId: platform.modelId,
        credentialId: null,
        apiKey: platform.apiKey,
        fetcher: options.fetcher,
      }),
    };
  }
  return { llm: null, resolution: { source: "deterministic", skipped: resolution.skipped }, decryptFailed };
}
