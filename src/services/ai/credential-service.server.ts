// Credential lifecycle for bring-your-own-key AI providers. Pure orchestration over an injected
// store, key ring and fetch, so behaviour is unit-testable and nothing here touches Supabase.
//
// Invariants: plaintext keys exist only inside these functions; they are never returned, logged,
// or placed in an error message; only ciphertext and the last four characters are persisted.

import { getAdapter } from "@/domain/ai/adapters";
import {
  decryptCredential,
  encryptCredential,
  keyLast4,
  needsRotation,
  type CredentialKeyRing,
} from "@/domain/ai/credential-crypto";
import { isAiProviderError } from "@/domain/ai/errors";
import { getAiProvider, isProviderConnectable } from "@/domain/ai/providers";
import type { AdapterDeps, NormalizedModel } from "@/domain/ai/types";

export const VALIDATION_WINDOW_MS = 10 * 60 * 1_000;
export const VALIDATION_LIMIT = 20;
export const MODEL_CACHE_TTL_MS = 6 * 60 * 60 * 1_000;
export const MODEL_CACHE_LIMIT = 3_000;

export type AiServiceErrorCode =
  | "not_configured"
  | "provider_unavailable"
  | "invalid_input"
  | "rate_limited"
  | "key_invalid"
  | "key_forbidden"
  | "network"
  | "label_taken"
  | "not_found"
  | "revoked"
  | "decrypt_failed";

export class AiServiceError extends Error {
  readonly code: AiServiceErrorCode;
  readonly retryAfterSeconds: number | null;
  constructor(code: AiServiceErrorCode, message: string, retryAfterSeconds: number | null = null) {
    super(message);
    this.name = "AiServiceError";
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export type Actor = { userId: string; workspaceId: string };

export type CredentialRecord = {
  id: string;
  workspaceId: string;
  userId: string;
  providerId: string;
  label: string;
  keyEncrypted: string | null;
  keyVersion: string | null;
  keyLast4: string;
  status: "active" | "invalid" | "revoked";
  lastVerifiedAt: string | null;
  lastErrorCode: string | null;
};

export type NewCredential = {
  workspaceId: string;
  userId: string;
  providerId: string;
  label: string;
  keyEncrypted: string;
  keyVersion: string;
  keyLast4: string;
  lastVerifiedAt: string;
};

export type CredentialPatch = Partial<{
  keyEncrypted: string | null;
  keyVersion: string | null;
  keyLast4: string;
  status: "active" | "invalid" | "revoked";
  lastVerifiedAt: string | null;
  lastErrorCode: string | null;
}>;

export interface CredentialStore {
  countAttempts(userId: string, sinceIso: string): Promise<number>;
  recordAttempt(attempt: Actor & { providerId: string; outcome: string }): Promise<void>;
  /** Throws {@link LabelConflictError} when (workspace, user, provider, label) already exists. */
  insert(row: NewCredential): Promise<CredentialRecord>;
  /** Returns the record only when it belongs to the actor. */
  get(id: string, actor: Actor): Promise<CredentialRecord | null>;
  update(id: string, patch: CredentialPatch): Promise<void>;
  remove(id: string): Promise<void>;
  deletePreferences(credentialId: string): Promise<void>;
  saveModels(credentialId: string, actor: Actor, models: NormalizedModel[]): Promise<void>;
  deleteModels(credentialId: string): Promise<void>;
  modelsFetchedAt(credentialId: string): Promise<string | null>;
}

export class LabelConflictError extends Error {
  constructor() {
    super("A key with this label already exists for this provider.");
    this.name = "LabelConflictError";
  }
}

export type CredentialServiceDeps = {
  store: CredentialStore;
  keyRing: () => CredentialKeyRing;
  adapters?: AdapterDeps;
  now?: () => number;
};

const KEY_PATTERN = /^[\x21-\x7e]{8,512}$/;

function cleanLabel(label: string) {
  const trimmed = label.trim();
  if (trimmed.length < 1 || trimmed.length > 60) {
    throw new AiServiceError("invalid_input", "Give the key a label of 1 to 60 characters.");
  }
  return trimmed;
}

function cleanKey(apiKey: string) {
  const trimmed = apiKey.trim();
  if (!KEY_PATTERN.test(trimmed)) {
    throw new AiServiceError(
      "invalid_input",
      "That does not look like an API key. Paste the key only, with no spaces or quotes.",
    );
  }
  return trimmed;
}

export function createCredentialService(deps: CredentialServiceDeps) {
  const now = deps.now ?? (() => Date.now());
  const iso = () => new Date(now()).toISOString();

  function requireProvider(providerId: string) {
    const provider = getAiProvider(providerId);
    if (!provider) throw new AiServiceError("invalid_input", "Unknown AI provider.");
    if (!isProviderConnectable(provider)) {
      throw new AiServiceError("provider_unavailable", `${provider.label} is not available yet.`);
    }
    return provider;
  }

  function ring() {
    try {
      return deps.keyRing();
    } catch {
      throw new AiServiceError(
        "not_configured",
        "Saving AI provider keys is not enabled on this deployment yet.",
      );
    }
  }

  async function enforceRateLimit(actor: Actor) {
    const since = new Date(now() - VALIDATION_WINDOW_MS).toISOString();
    if ((await deps.store.countAttempts(actor.userId, since)) >= VALIDATION_LIMIT) {
      throw new AiServiceError(
        "rate_limited",
        "Too many key checks. Wait a few minutes and try again.",
        Math.ceil(VALIDATION_WINDOW_MS / 1_000),
      );
    }
  }

  /** Validates a key with the provider and records the (key-free) attempt. */
  async function validate(actor: Actor, providerId: string, apiKey: string) {
    await enforceRateLimit(actor);
    const result = await getAdapter(providerId, deps.adapters).validateKey(apiKey);
    await deps.store.recordAttempt({
      ...actor,
      providerId,
      outcome: result.ok ? "ok" : result.reason,
    });
    return result;
  }

  function throwForRejected(
    label: string,
    reason: "invalid" | "forbidden" | "rate_limited" | "network",
  ): never {
    switch (reason) {
      case "invalid":
        throw new AiServiceError(
          "key_invalid",
          `${label} rejected this key. Check that you copied it completely.`,
        );
      case "forbidden":
        throw new AiServiceError(
          "key_forbidden",
          `${label} accepted the key but does not allow it to list models. Check its permissions.`,
        );
      case "rate_limited":
        throw new AiServiceError(
          "rate_limited",
          `${label} is rate limiting this key right now. Try again shortly.`,
          60,
        );
      case "network":
        throw new AiServiceError(
          "network",
          `Vidrial could not reach ${label} to check the key. Try again.`,
        );
    }
  }

  async function load(id: string, actor: Actor) {
    const record = await deps.store.get(id, actor);
    if (!record) throw new AiServiceError("not_found", "That key was not found.");
    return record;
  }

  async function decrypt(record: CredentialRecord): Promise<string> {
    if (record.status === "revoked" || !record.keyEncrypted) {
      throw new AiServiceError("revoked", "This key was revoked. Add it again to use it.");
    }
    try {
      const key = ring();
      const apiKey = await decryptCredential(
        record.keyEncrypted,
        { workspaceId: record.workspaceId, userId: record.userId, providerId: record.providerId },
        key,
      );
      if (needsRotation(record.keyEncrypted, key)) {
        // Opportunistic re-encryption under the current key version; failure is harmless.
        try {
          const fresh = await encryptCredential(
            apiKey,
            {
              workspaceId: record.workspaceId,
              userId: record.userId,
              providerId: record.providerId,
            },
            key,
          );
          await deps.store.update(record.id, {
            keyEncrypted: fresh.envelope,
            keyVersion: fresh.keyVersion,
          });
        } catch {
          // Keep the old envelope; it is still readable while the previous key is configured.
        }
      }
      return apiKey;
    } catch (error) {
      if (error instanceof AiServiceError) throw error;
      throw new AiServiceError(
        "decrypt_failed",
        "This stored key can no longer be read. Add it again to keep using it.",
      );
    }
  }

  async function refreshModelsFor(record: CredentialRecord, actor: Actor, apiKey: string) {
    const models = await getAdapter(record.providerId, deps.adapters).listModels(apiKey);
    const bounded = models.slice(0, MODEL_CACHE_LIMIT);
    await deps.store.saveModels(record.id, actor, bounded);
    return bounded.length;
  }

  return {
    /** Validates, encrypts and stores a new key, then caches its model list. */
    async connect(input: Actor & { providerId: string; label: string; apiKey: string }) {
      const actor = { userId: input.userId, workspaceId: input.workspaceId };
      const provider = requireProvider(input.providerId);
      const label = cleanLabel(input.label);
      const apiKey = cleanKey(input.apiKey);
      const keyRing = ring();

      const result = await validate(actor, provider.id, apiKey);
      if (!result.ok) throwForRejected(provider.label, result.reason);

      const { envelope, keyVersion } = await encryptCredential(
        apiKey,
        { ...actor, providerId: provider.id },
        keyRing,
      );
      let record: CredentialRecord;
      try {
        record = await deps.store.insert({
          ...actor,
          providerId: provider.id,
          label,
          keyEncrypted: envelope,
          keyVersion,
          keyLast4: keyLast4(apiKey),
          lastVerifiedAt: iso(),
        });
      } catch (error) {
        if (error instanceof LabelConflictError) {
          throw new AiServiceError(
            "label_taken",
            "You already have a key with that label for this provider.",
          );
        }
        throw error;
      }
      let modelCount: number | null = null;
      try {
        modelCount = await refreshModelsFor(record, actor, apiKey);
      } catch (error) {
        // The key is valid; listing can be retried from the UI.
        if (!isAiProviderError(error)) throw error;
      }
      return { id: record.id, modelCount };
    },

    /** Replaces the secret behind an existing connection (rotation by the user). */
    async replaceKey(input: Actor & { credentialId: string; apiKey: string }) {
      const actor = { userId: input.userId, workspaceId: input.workspaceId };
      const record = await load(input.credentialId, actor);
      const provider = requireProvider(record.providerId);
      const apiKey = cleanKey(input.apiKey);
      const keyRing = ring();
      const result = await validate(actor, provider.id, apiKey);
      if (!result.ok) throwForRejected(provider.label, result.reason);
      const { envelope, keyVersion } = await encryptCredential(
        apiKey,
        { ...actor, providerId: record.providerId },
        keyRing,
      );
      await deps.store.update(record.id, {
        keyEncrypted: envelope,
        keyVersion,
        keyLast4: keyLast4(apiKey),
        status: "active",
        lastVerifiedAt: iso(),
        lastErrorCode: null,
      });
      let modelCount: number | null = null;
      try {
        modelCount = await refreshModelsFor({ ...record, status: "active" }, actor, apiKey);
      } catch (error) {
        if (!isAiProviderError(error)) throw error;
      }
      return { id: record.id, modelCount };
    },

    /** Re-checks a stored key and updates its status honestly. */
    async revalidate(input: Actor & { credentialId: string }) {
      const actor = { userId: input.userId, workspaceId: input.workspaceId };
      const record = await load(input.credentialId, actor);
      const provider = requireProvider(record.providerId);
      const apiKey = await decrypt(record);
      const result = await validate(actor, record.providerId, apiKey);
      if (result.ok) {
        await deps.store.update(record.id, {
          status: "active",
          lastVerifiedAt: iso(),
          lastErrorCode: null,
        });
        return { status: "active" as const };
      }
      if (result.reason === "invalid" || result.reason === "forbidden") {
        await deps.store.update(record.id, {
          status: "invalid",
          lastErrorCode: result.reason === "invalid" ? "invalid_key" : "forbidden",
        });
        return { status: "invalid" as const };
      }
      // Rate limits and network failures say nothing about the key; do not flip its status.
      await deps.store.update(record.id, {
        lastErrorCode: result.reason === "rate_limited" ? "rate_limited" : "network",
      });
      throwForRejected(provider.label, result.reason);
    },

    /** Refreshes the cached model list; honours the TTL unless forced. */
    async refreshModels(input: Actor & { credentialId: string; force?: boolean }) {
      const actor = { userId: input.userId, workspaceId: input.workspaceId };
      const record = await load(input.credentialId, actor);
      requireProvider(record.providerId);
      if (!input.force) {
        const fetched = await deps.store.modelsFetchedAt(record.id);
        if (fetched && now() - Date.parse(fetched) < MODEL_CACHE_TTL_MS) {
          return { refreshed: false as const };
        }
      }
      const apiKey = await decrypt(record);
      try {
        return {
          refreshed: true as const,
          modelCount: await refreshModelsFor(record, actor, apiKey),
        };
      } catch (error) {
        if (isAiProviderError(error)) {
          if (error.invalidatesCredential) {
            await deps.store.update(record.id, { status: "invalid", lastErrorCode: error.code });
          }
          throw new AiServiceError(
            error.invalidatesCredential
              ? "key_invalid"
              : error.code === "rate_limited"
                ? "rate_limited"
                : "network",
            error.invalidatesCredential
              ? "The provider rejected this key. Reconnect it in AI providers settings."
              : "The provider's model list could not be loaded. Try again shortly.",
            error.retryAfterSeconds,
          );
        }
        throw error;
      }
    },

    /** Wipes the ciphertext and detaches defaults. The row stays so history remains explainable. */
    async revoke(input: Actor & { credentialId: string }) {
      const actor = { userId: input.userId, workspaceId: input.workspaceId };
      const record = await load(input.credentialId, actor);
      await deps.store.update(record.id, {
        status: "revoked",
        keyEncrypted: null,
        keyVersion: null,
        lastErrorCode: null,
      });
      await deps.store.deletePreferences(record.id);
      await deps.store.deleteModels(record.id);
    },

    /** Removes the connection entirely. */
    async remove(input: Actor & { credentialId: string }) {
      const actor = { userId: input.userId, workspaceId: input.workspaceId };
      const record = await load(input.credentialId, actor);
      await deps.store.remove(record.id);
    },

    /** Server-internal: returns the plaintext key for an outbound provider call. Never serialise it. */
    async resolveKey(input: Actor & { credentialId: string }) {
      const actor = { userId: input.userId, workspaceId: input.workspaceId };
      const record = await load(input.credentialId, actor);
      if (record.status === "invalid") {
        throw new AiServiceError(
          "key_invalid",
          "This key was rejected by the provider. Reconnect it in AI providers settings.",
        );
      }
      return {
        apiKey: await decrypt(record),
        providerId: record.providerId,
        credentialId: record.id,
      };
    },

    /** Called when a live request proved the key no longer works. */
    async markInvalid(input: Actor & { credentialId: string; code: string }) {
      const actor = { userId: input.userId, workspaceId: input.workspaceId };
      const record = await deps.store.get(input.credentialId, actor);
      if (record && record.status === "active") {
        await deps.store.update(record.id, {
          status: "invalid",
          lastErrorCode: input.code.slice(0, 64),
        });
      }
    },
  };
}

export type CredentialService = ReturnType<typeof createCredentialService>;
