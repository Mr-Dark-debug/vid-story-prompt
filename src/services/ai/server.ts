import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getServerEnv } from "@/config/env.server";
import { parseCredentialKeyRing } from "@/domain/ai/credential-crypto";
import { AI_PROVIDERS, getAiProvider, isProviderConnectable } from "@/domain/ai/providers";
import { AI_PURPOSES, type AiPurpose, type NormalizedModel } from "@/domain/ai/types";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentSession } from "@/services/auth/server";
import { AiServiceError, createCredentialService, type Actor } from "./credential-service.server";
import { createSupabaseCredentialStore } from "./credential-store.server";

function credentialService() {
  return createCredentialService({
    store: createSupabaseCredentialStore(),
    keyRing: () => parseCredentialKeyRing(getServerEnv()),
  });
}

async function requireActor(): Promise<Actor> {
  const session = await getCurrentSession();
  if (!session?.workspaceId) throw new Error("Sign in to manage AI providers.");
  return { userId: session.id, workspaceId: session.workspaceId };
}

/** AiServiceError messages are written to be shown to users; anything else is replaced. */
async function guarded<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof AiServiceError) throw new Error(error.message);
    throw new Error("Something went wrong while talking to the AI provider. Try again.");
  }
}

const providerIdSchema = z
  .string()
  .min(2)
  .max(32)
  .refine((id) => Boolean(getAiProvider(id)), "Unknown provider");
const credentialIdSchema = z.string().uuid();

export type AiConnection = {
  id: string;
  providerId: string;
  label: string;
  last4: string;
  status: "active" | "invalid" | "revoked";
  lastVerifiedAt: string | null;
  lastErrorCode: string | null;
  modelCount: number | null;
  modelsFetchedAt: string | null;
};

/** Registry-driven provider list plus the caller's connections. Never includes key material. */
export const getAiProviderOverview = createServerFn({ method: "GET" }).handler(async () => {
  const actor = await requireActor();
  let encryptionConfigured = true;
  try {
    parseCredentialKeyRing(getServerEnv());
  } catch {
    encryptionConfigured = false;
  }
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("ai_provider_connections")
    .select(
      "id,provider_id,label,key_last4,status,last_verified_at,last_error_code,model_count,models_fetched_at",
    )
    .eq("workspace_id", actor.workspaceId)
    .order("created_at");
  if (error) throw new Error("AI provider connections could not be loaded.");
  const connections: AiConnection[] = [];
  for (const row of data ?? []) {
    // View columns are nullable in the generated types; a row without these is not usable.
    if (!row.id || !row.provider_id || !row.label || !row.key_last4 || !row.status) continue;
    connections.push({
      id: row.id,
      providerId: row.provider_id,
      label: row.label,
      last4: row.key_last4,
      status: row.status as AiConnection["status"],
      lastVerifiedAt: row.last_verified_at,
      lastErrorCode: row.last_error_code,
      modelCount: row.model_count,
      modelsFetchedAt: row.models_fetched_at,
    });
  }
  return {
    encryptionConfigured,
    providers: AI_PROVIDERS.map((provider) => ({
      id: provider.id,
      label: provider.label,
      kind: provider.kind,
      logoKey: provider.logoKey,
      keyHelpUrl: provider.keyHelpUrl,
      keyPrefixHint: provider.keyPrefixHint,
      availability: provider.availability,
      description: provider.description,
      capabilities: provider.capabilities,
      connectable: isProviderConnectable(provider),
    })),
    connections,
  };
});

export const connectAiProvider = createServerFn({ method: "POST" })
  .validator(
    z.object({
      providerId: providerIdSchema,
      label: z.string().min(1).max(60),
      apiKey: z.string().min(8).max(512),
    }),
  )
  .handler(({ data }) =>
    guarded(async () => ({
      ...(await credentialService().connect({ ...(await requireActor()), ...data })),
    })),
  );

export const replaceAiProviderKey = createServerFn({ method: "POST" })
  .validator(z.object({ credentialId: credentialIdSchema, apiKey: z.string().min(8).max(512) }))
  .handler(({ data }) =>
    guarded(async () => credentialService().replaceKey({ ...(await requireActor()), ...data })),
  );

export const revalidateAiProvider = createServerFn({ method: "POST" })
  .validator(z.object({ credentialId: credentialIdSchema }))
  .handler(({ data }) =>
    guarded(async () => credentialService().revalidate({ ...(await requireActor()), ...data })),
  );

export const refreshAiModels = createServerFn({ method: "POST" })
  .validator(z.object({ credentialId: credentialIdSchema, force: z.boolean().default(false) }))
  .handler(({ data }) =>
    guarded(async () => credentialService().refreshModels({ ...(await requireActor()), ...data })),
  );

export const revokeAiProvider = createServerFn({ method: "POST" })
  .validator(z.object({ credentialId: credentialIdSchema }))
  .handler(({ data }) =>
    guarded(async () => {
      await credentialService().revoke({ ...(await requireActor()), ...data });
      return { ok: true as const };
    }),
  );

export const deleteAiProvider = createServerFn({ method: "POST" })
  .validator(z.object({ credentialId: credentialIdSchema }))
  .handler(({ data }) =>
    guarded(async () => {
      await credentialService().remove({ ...(await requireActor()), ...data });
      return { ok: true as const };
    }),
  );

export type AiModelGroup = {
  credentialId: string;
  providerId: string;
  label: string;
  status: "active" | "invalid" | "revoked";
  fetchedAt: string;
  models: NormalizedModel[];
};

/** Cached models for every usable connection, read through the caller's RLS-scoped session. */
export const listAiModels = createServerFn({ method: "GET" }).handler(async () => {
  const actor = await requireActor();
  const supabase = getSupabaseServerClient();
  const [{ data: connections, error: connectionError }, { data: caches, error: cacheError }] =
    await Promise.all([
      supabase
        .from("ai_provider_connections")
        .select("id,provider_id,label,status")
        .eq("workspace_id", actor.workspaceId)
        .neq("status", "revoked"),
      supabase
        .from("ai_model_cache")
        .select("credential_id,models_json,fetched_at")
        .eq("workspace_id", actor.workspaceId),
    ]);
  if (connectionError || cacheError) throw new Error("Models could not be loaded.");
  const byCredential = new Map((caches ?? []).map((cache) => [cache.credential_id, cache]));
  const groups: AiModelGroup[] = [];
  for (const connection of connections ?? []) {
    if (!connection.id || !connection.provider_id || !connection.label || !connection.status)
      continue;
    const cache = byCredential.get(connection.id);
    if (!cache || !Array.isArray(cache.models_json)) continue;
    groups.push({
      credentialId: connection.id,
      providerId: connection.provider_id,
      label: connection.label,
      status: connection.status as AiModelGroup["status"],
      fetchedAt: cache.fetched_at,
      models: cache.models_json as unknown as NormalizedModel[],
    });
  }
  return groups;
});

export type AiPreference = {
  purpose: AiPurpose;
  credentialId: string;
  modelId: string;
};

export const getAiPreferences = createServerFn({ method: "GET" }).handler(async () => {
  const actor = await requireActor();
  const { data, error } = await getSupabaseServerClient()
    .from("ai_user_preferences")
    .select("purpose,credential_id,model_id")
    .eq("workspace_id", actor.workspaceId);
  if (error) throw new Error("AI model preferences could not be loaded.");
  return (data ?? []).map(
    (row): AiPreference => ({
      purpose: row.purpose as AiPurpose,
      credentialId: row.credential_id,
      modelId: row.model_id,
    }),
  );
});

export const setAiPreference = createServerFn({ method: "POST" })
  .validator(
    z.object({
      purpose: z.enum(AI_PURPOSES),
      credentialId: credentialIdSchema.nullable(),
      modelId: z.string().min(1).max(200).nullable(),
    }),
  )
  .handler(async ({ data }) => {
    const actor = await requireActor();
    const supabase = getSupabaseServerClient();
    if (data.credentialId === null || data.modelId === null) {
      const { error } = await supabase
        .from("ai_user_preferences")
        .delete()
        .eq("workspace_id", actor.workspaceId)
        .eq("user_id", actor.userId)
        .eq("purpose", data.purpose);
      if (error) throw new Error("The default model could not be cleared.");
      return { ok: true as const };
    }
    // Row-level security requires the credential to be the caller's own and active.
    const { error } = await supabase.from("ai_user_preferences").upsert(
      {
        workspace_id: actor.workspaceId,
        user_id: actor.userId,
        purpose: data.purpose,
        credential_id: data.credentialId,
        model_id: data.modelId,
      },
      { onConflict: "workspace_id,user_id,purpose" },
    );
    if (error)
      throw new Error("The default model could not be saved. Check that the key is active.");
    return { ok: true as const };
  });
