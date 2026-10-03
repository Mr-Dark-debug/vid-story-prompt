import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getServerEnv } from "@/config/env.server";
import { parseCredentialKeyRing } from "@/domain/ai/credential-crypto";
import type { MessageStatus } from "@/domain/ai/message-state";
import type { Database } from "@/lib/supabase/database.types";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentSession } from "@/services/auth/server";
import { createChatService } from "./chat-service.server";
import { createSupabaseChatStore, toMessageRecord } from "./chat-store.server";
import { createCredentialService, type Actor } from "./credential-service.server";
import { createSupabaseCredentialStore } from "./credential-store.server";

export type ChatThreadSummary = {
  id: string;
  title: string;
  archivedAt: string | null;
  lastMessageAt: string;
  providerId: string | null;
  modelId: string | null;
  credentialId: string | null;
  clipJobId: string | null;
};

export type ChatMessageDto = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  status: MessageStatus;
  providerId: string | null;
  modelId: string | null;
  usageInputTokens: number | null;
  usageOutputTokens: number | null;
  errorCode: string | null;
  parentMessageId: string | null;
  createdAt: string;
};

const SUMMARY_COLUMNS =
  "id,title,archived_at,last_message_at,provider_id,model_id,credential_id,clip_job_id";

async function requireActor(): Promise<Actor> {
  const session = await getCurrentSession();
  if (!session?.workspaceId) throw new Error("Sign in to use AI chat.");
  return { userId: session.id, workspaceId: session.workspaceId };
}

function toSummary(row: {
  id: string;
  title: string;
  archived_at: string | null;
  last_message_at: string;
  provider_id: string | null;
  model_id: string | null;
  credential_id: string | null;
  clip_job_id: string | null;
}): ChatThreadSummary {
  return {
    id: row.id,
    title: row.title,
    archivedAt: row.archived_at,
    lastMessageAt: row.last_message_at,
    providerId: row.provider_id,
    modelId: row.model_id,
    credentialId: row.credential_id,
    clipJobId: row.clip_job_id,
  };
}

/** The connection must be the caller's own and usable; RLS scopes the lookup. */
async function activeConnection(credentialId: string) {
  const { data, error } = await getSupabaseServerClient()
    .from("ai_provider_connections")
    .select("id,provider_id,status")
    .eq("id", credentialId)
    .maybeSingle();
  if (error || !data || data.status !== "active" || !data.provider_id) {
    throw new Error("That key is not available. Reconnect it in AI providers settings.");
  }
  return { credentialId, providerId: data.provider_id };
}

const uuid = z.string().uuid();

export const listChatThreads = createServerFn({ method: "GET" })
  .validator(z.object({ archived: z.boolean().default(false) }).default({ archived: false }))
  .handler(async ({ data }) => {
    const actor = await requireActor();
    let query = getSupabaseServerClient()
      .from("ai_chat_threads")
      .select(SUMMARY_COLUMNS)
      .eq("workspace_id", actor.workspaceId);
    query = data.archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
    const { data: rows, error } = await query
      .order("last_message_at", { ascending: false })
      .limit(300);
    if (error) throw new Error("Chats could not be loaded.");
    return (rows ?? []).map(toSummary);
  });

export const createChatThread = createServerFn({ method: "POST" })
  .validator(
    z.object({
      credentialId: uuid.nullable().default(null),
      modelId: z.string().min(1).max(200).nullable().default(null),
      clipJobId: uuid.nullable().default(null),
    }),
  )
  .handler(async ({ data }) => {
    const actor = await requireActor();
    const supabase = getSupabaseServerClient();
    let credentialId = data.credentialId;
    let modelId = data.modelId;
    if (!credentialId || !modelId) {
      // Fall back to the user's default chat model, if they set one.
      const { data: preference } = await supabase
        .from("ai_user_preferences")
        .select("credential_id,model_id")
        .eq("workspace_id", actor.workspaceId)
        .eq("purpose", "chat")
        .maybeSingle();
      credentialId = preference?.credential_id ?? null;
      modelId = preference?.model_id ?? null;
    }
    let providerId: string | null = null;
    if (credentialId && modelId) {
      try {
        providerId = (await activeConnection(credentialId)).providerId;
      } catch {
        credentialId = null;
        modelId = null;
      }
    }
    const { data: row, error } = await supabase
      .from("ai_chat_threads")
      .insert({
        workspace_id: actor.workspaceId,
        user_id: actor.userId,
        credential_id: credentialId,
        provider_id: providerId,
        model_id: credentialId ? modelId : null,
        clip_job_id: data.clipJobId,
      })
      .select(SUMMARY_COLUMNS)
      .single();
    if (error || !row) throw new Error("The chat could not be created.");
    return toSummary(row);
  });

export const getChatThread = createServerFn({ method: "GET" })
  .validator(z.object({ threadId: uuid }))
  .handler(async ({ data }) => {
    const actor = await requireActor();
    const service = createChatService({
      store: createSupabaseChatStore(),
      credentials: createCredentialService({
        store: createSupabaseCredentialStore(),
        keyRing: () => parseCredentialKeyRing(getServerEnv()),
      }),
    });
    // Anything an abandoned request left streaming is settled before the user sees it.
    await service.reconcileStale(actor, data.threadId);
    const supabase = getSupabaseServerClient();
    const [{ data: thread, error }, { data: rows, error: messageError }] = await Promise.all([
      supabase
        .from("ai_chat_threads")
        .select(`${SUMMARY_COLUMNS},system_prompt`)
        .eq("id", data.threadId)
        .eq("workspace_id", actor.workspaceId)
        .maybeSingle(),
      supabase
        .from("ai_chat_messages")
        .select()
        .eq("thread_id", data.threadId)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true }),
    ]);
    if (error || messageError) throw new Error("The chat could not be loaded.");
    if (!thread) throw new Error("That chat was not found.");
    const messages: ChatMessageDto[] = (rows ?? []).map((row) => {
      const record = toMessageRecord(row);
      return {
        id: record.id,
        role: record.role,
        content: record.content,
        status: record.status,
        providerId: record.providerId,
        modelId: record.modelId,
        usageInputTokens: record.usageInputTokens,
        usageOutputTokens: record.usageOutputTokens,
        errorCode: record.errorCode,
        parentMessageId: record.parentMessageId,
        createdAt: record.createdAt,
      };
    });
    return { thread: { ...toSummary(thread), systemPrompt: thread.system_prompt }, messages };
  });

export const updateChatThread = createServerFn({ method: "POST" })
  .validator(
    z.object({
      threadId: uuid,
      title: z.string().trim().min(1).max(160).optional(),
      archived: z.boolean().optional(),
      systemPrompt: z.string().max(4000).nullable().optional(),
      clipJobId: uuid.nullable().optional(),
      model: z.object({ credentialId: uuid, modelId: z.string().min(1).max(200) }).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const actor = await requireActor();
    const update: Database["public"]["Tables"]["ai_chat_threads"]["Update"] = {};
    if (data.title !== undefined) update.title = data.title;
    if (data.archived !== undefined)
      update.archived_at = data.archived ? new Date().toISOString() : null;
    if (data.systemPrompt !== undefined) update.system_prompt = data.systemPrompt?.trim() || null;
    if (data.clipJobId !== undefined) update.clip_job_id = data.clipJobId;
    if (data.model) {
      const connection = await activeConnection(data.model.credentialId);
      update.credential_id = connection.credentialId;
      update.provider_id = connection.providerId;
      update.model_id = data.model.modelId;
    }
    if (Object.keys(update).length === 0) return { ok: true as const };
    const { error } = await getSupabaseServerClient()
      .from("ai_chat_threads")
      .update(update)
      .eq("id", data.threadId)
      .eq("workspace_id", actor.workspaceId);
    if (error) throw new Error("The chat could not be updated.");
    return { ok: true as const };
  });

/** A real delete: messages cascade and nothing is retained. */
export const deleteChatThread = createServerFn({ method: "POST" })
  .validator(z.object({ threadId: uuid }))
  .handler(async ({ data }) => {
    const actor = await requireActor();
    const { error } = await getSupabaseServerClient()
      .from("ai_chat_threads")
      .delete()
      .eq("id", data.threadId)
      .eq("workspace_id", actor.workspaceId);
    if (error) throw new Error("The chat could not be deleted.");
    return { ok: true as const };
  });

export const deleteAllChatThreads = createServerFn({ method: "POST" }).handler(async () => {
  const actor = await requireActor();
  const { error } = await getSupabaseServerClient()
    .from("ai_chat_threads")
    .delete()
    .eq("workspace_id", actor.workspaceId)
    .eq("user_id", actor.userId);
  if (error) throw new Error("Your chats could not be deleted.");
  return { ok: true as const };
});

export const cancelChatMessage = createServerFn({ method: "POST" })
  .validator(z.object({ threadId: uuid, messageId: uuid }))
  .handler(async ({ data }) => {
    const actor = await requireActor();
    const service = createChatService({
      store: createSupabaseChatStore(),
      credentials: createCredentialService({
        store: createSupabaseCredentialStore(),
        keyRing: () => parseCredentialKeyRing(getServerEnv()),
      }),
    });
    try {
      return await service.cancel(actor, data.threadId, data.messageId);
    } catch {
      throw new Error("That reply could not be stopped.");
    }
  });

export const listAttachableClipJobs = createServerFn({ method: "GET" }).handler(async () => {
  const actor = await requireActor();
  const { data, error } = await getSupabaseServerClient()
    .from("clip_jobs")
    .select("id,source_title,created_at,status")
    .eq("workspace_id", actor.workspaceId)
    .order("created_at", { ascending: false })
    .limit(25);
  if (error) throw new Error("Clip jobs could not be loaded.");
  return (data ?? []).map((job) => ({
    id: job.id,
    title: job.source_title ?? "Untitled source",
    createdAt: job.created_at,
    status: job.status,
  }));
});

export const getChatRetention = createServerFn({ method: "GET" }).handler(async () => {
  const actor = await requireActor();
  const { data } = await getSupabaseServerClient()
    .from("ai_user_settings")
    .select("chat_retention_days")
    .eq("workspace_id", actor.workspaceId)
    .eq("user_id", actor.userId)
    .maybeSingle();
  return { days: data?.chat_retention_days ?? null };
});

export const setChatRetention = createServerFn({ method: "POST" })
  .validator(z.object({ days: z.number().int().min(1).max(3650).nullable() }))
  .handler(async ({ data }) => {
    const actor = await requireActor();
    const { error } = await getSupabaseServerClient().from("ai_user_settings").upsert(
      {
        workspace_id: actor.workspaceId,
        user_id: actor.userId,
        chat_retention_days: data.days,
      },
      { onConflict: "workspace_id,user_id" },
    );
    if (error) throw new Error("The retention setting could not be saved.");
    return { days: data.days };
  });
