import type { NormalizedModel } from "@/domain/ai/types";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import {
  LabelConflictError,
  type Actor,
  type CredentialPatch,
  type CredentialRecord,
  type CredentialStore,
} from "./credential-service.server";

type Row = Database["public"]["Tables"]["ai_provider_credentials"]["Row"];

function toRecord(row: Row): CredentialRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    providerId: row.provider_id,
    label: row.label,
    keyEncrypted: row.key_encrypted,
    keyVersion: row.key_version,
    keyLast4: row.key_last4,
    status: row.status as CredentialRecord["status"],
    lastVerifiedAt: row.last_verified_at,
    lastErrorCode: row.last_error_code,
  };
}

function fail(operation: string, error: { message: string; code?: string }): never {
  // Database messages can echo row values; report only the operation and SQLSTATE.
  throw new Error(
    `AI credential store ${operation} failed${error.code ? ` (${error.code})` : ""}.`,
  );
}

/**
 * Service-role store. It is the only code that reads or writes ciphertext, and every lookup is
 * scoped to the acting user and workspace in addition to the caller's own session checks.
 */
export function createSupabaseCredentialStore(): CredentialStore {
  const db = () => getSupabaseAdminClient();
  return {
    async countAttempts(userId, sinceIso) {
      const { count, error } = await db()
        .from("ai_credential_attempts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", sinceIso);
      if (error) fail("rate-limit lookup", error);
      return count ?? 0;
    },

    async recordAttempt(attempt) {
      const { error } = await db()
        .from("ai_credential_attempts")
        .insert({
          user_id: attempt.userId,
          workspace_id: attempt.workspaceId,
          provider_id: attempt.providerId,
          outcome: attempt.outcome.slice(0, 32),
        });
      if (error) fail("attempt log", error);
    },

    async insert(row) {
      const { data, error } = await db()
        .from("ai_provider_credentials")
        .insert({
          workspace_id: row.workspaceId,
          user_id: row.userId,
          provider_id: row.providerId,
          label: row.label,
          key_encrypted: row.keyEncrypted,
          key_version: row.keyVersion,
          key_last4: row.keyLast4,
          last_verified_at: row.lastVerifiedAt,
        })
        .select()
        .single();
      if (error) {
        if (error.code === "23505") throw new LabelConflictError();
        fail("insert", error);
      }
      return toRecord(data as Row);
    },

    async get(id, actor: Actor) {
      const { data, error } = await db()
        .from("ai_provider_credentials")
        .select()
        .eq("id", id)
        .eq("user_id", actor.userId)
        .eq("workspace_id", actor.workspaceId)
        .maybeSingle();
      if (error) fail("lookup", error);
      return data ? toRecord(data as Row) : null;
    },

    async update(id, patch: CredentialPatch) {
      const update: Database["public"]["Tables"]["ai_provider_credentials"]["Update"] = {};
      if (patch.keyEncrypted !== undefined) update.key_encrypted = patch.keyEncrypted;
      if (patch.keyVersion !== undefined) update.key_version = patch.keyVersion;
      if (patch.keyLast4 !== undefined) update.key_last4 = patch.keyLast4;
      if (patch.status !== undefined) update.status = patch.status;
      if (patch.lastVerifiedAt !== undefined) update.last_verified_at = patch.lastVerifiedAt;
      if (patch.lastErrorCode !== undefined) update.last_error_code = patch.lastErrorCode;
      const { error } = await db().from("ai_provider_credentials").update(update).eq("id", id);
      if (error) fail("update", error);
    },

    async remove(id) {
      const { error } = await db().from("ai_provider_credentials").delete().eq("id", id);
      if (error) fail("delete", error);
    },

    async deletePreferences(credentialId) {
      const { error } = await db()
        .from("ai_user_preferences")
        .delete()
        .eq("credential_id", credentialId);
      if (error) fail("preference cleanup", error);
    },

    async saveModels(credentialId, actor, models: NormalizedModel[]) {
      const { error } = await db()
        .from("ai_model_cache")
        .upsert({
          credential_id: credentialId,
          workspace_id: actor.workspaceId,
          user_id: actor.userId,
          models_json:
            models as unknown as Database["public"]["Tables"]["ai_model_cache"]["Row"]["models_json"],
          model_count: models.length,
          fetched_at: new Date().toISOString(),
        });
      if (error) fail("model cache write", error);
    },

    async deleteModels(credentialId) {
      const { error } = await db()
        .from("ai_model_cache")
        .delete()
        .eq("credential_id", credentialId);
      if (error) fail("model cache delete", error);
    },

    async modelsFetchedAt(credentialId) {
      const { data, error } = await db()
        .from("ai_model_cache")
        .select("fetched_at")
        .eq("credential_id", credentialId)
        .maybeSingle();
      if (error) fail("model cache lookup", error);
      return data?.fetched_at ?? null;
    },
  };
}
