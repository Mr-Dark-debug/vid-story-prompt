import type { AttachmentInput } from "@/domain/ai/chat-context";
import type { MessageStatus } from "@/domain/ai/message-state";
import type { FinishReason, NormalizedModel } from "@/domain/ai/types";
import type { Database } from "@/lib/supabase/database.types";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { Actor } from "./credential-service.server";
import type { ChatStore, MessagePatch, MessageRecord, ThreadRecord } from "./chat-service.server";

type MessageRow = Database["public"]["Tables"]["ai_chat_messages"]["Row"];
type ThreadRow = Database["public"]["Tables"]["ai_chat_threads"]["Row"];

const STREAM_FRESH_SECONDS = 60;

function fail(operation: string, error: { code?: string }): never {
  // Database messages can echo content; report the operation and SQLSTATE only.
  throw new Error(`AI chat store ${operation} failed${error.code ? ` (${error.code})` : ""}.`);
}

export function toMessageRecord(row: MessageRow): MessageRecord {
  return {
    id: row.id,
    threadId: row.thread_id,
    role: row.role as MessageRecord["role"],
    content: row.content,
    status: row.status as MessageStatus,
    providerId: row.provider_id,
    modelId: row.model_id,
    usageInputTokens: row.usage_input_tokens,
    usageOutputTokens: row.usage_output_tokens,
    finishReason: row.finish_reason,
    errorCode: row.error_code,
    parentMessageId: row.parent_message_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toThreadRecord(row: ThreadRow): ThreadRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    title: row.title,
    credentialId: row.credential_id,
    providerId: row.provider_id,
    modelId: row.model_id,
    systemPrompt: row.system_prompt,
    clipJobId: row.clip_job_id,
  };
}

function toRowPatch(patch: MessagePatch) {
  const update: Database["public"]["Tables"]["ai_chat_messages"]["Update"] = {};
  if (patch.content !== undefined) update.content = patch.content;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.usageInputTokens !== undefined) update.usage_input_tokens = patch.usageInputTokens;
  if (patch.usageOutputTokens !== undefined) update.usage_output_tokens = patch.usageOutputTokens;
  if (patch.finishReason !== undefined)
    update.finish_reason = patch.finishReason as FinishReason | null;
  if (patch.errorCode !== undefined) update.error_code = patch.errorCode;
  if (patch.completedAt !== undefined) update.completed_at = patch.completedAt;
  return update;
}

/** Service-role chat store. Every query is scoped to the acting user and workspace. */
export function createSupabaseChatStore(): ChatStore {
  const db = () => getSupabaseAdminClient();
  return {
    async getThread(id, actor: Actor) {
      const { data, error } = await db()
        .from("ai_chat_threads")
        .select()
        .eq("id", id)
        .eq("user_id", actor.userId)
        .eq("workspace_id", actor.workspaceId)
        .maybeSingle();
      if (error) fail("thread lookup", error);
      return data ? toThreadRecord(data as ThreadRow) : null;
    },

    async listMessages(threadId, actor) {
      const { data, error } = await db()
        .from("ai_chat_messages")
        .select()
        .eq("thread_id", threadId)
        .eq("user_id", actor.userId)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true });
      if (error) fail("message list", error);
      return (data ?? []).map((row) => toMessageRecord(row as MessageRow));
    },

    async insertMessage(row) {
      const { data, error } = await db()
        .from("ai_chat_messages")
        .insert({
          thread_id: row.threadId,
          workspace_id: row.actor.workspaceId,
          user_id: row.actor.userId,
          role: row.role,
          content: row.content,
          status: row.status,
          provider_id: row.providerId ?? null,
          model_id: row.modelId ?? null,
          parent_message_id: row.parentMessageId ?? null,
        })
        .select()
        .single();
      if (error) fail("message insert", error);
      // Keep the thread list ordered by recent activity.
      await db()
        .from("ai_chat_threads")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", row.threadId);
      return toMessageRecord(data as MessageRow);
    },

    async updateMessage(id, patch, onlyWhen) {
      const { data, error } = await db()
        .from("ai_chat_messages")
        .update(toRowPatch(patch))
        .eq("id", id)
        .in("status", [...onlyWhen])
        .select("id");
      if (error) fail("message update", error);
      return (data?.length ?? 0) > 0;
    },

    async deleteFrom(threadId, actor, messageId) {
      const { data: anchor, error: anchorError } = await db()
        .from("ai_chat_messages")
        .select("created_at")
        .eq("id", messageId)
        .eq("thread_id", threadId)
        .eq("user_id", actor.userId)
        .maybeSingle();
      if (anchorError) fail("message lookup", anchorError);
      if (!anchor) return;
      const { error } = await db()
        .from("ai_chat_messages")
        .delete()
        .eq("thread_id", threadId)
        .eq("user_id", actor.userId)
        .gte("created_at", anchor.created_at);
      if (error) fail("message delete", error);
    },

    async touchThread(id, patch) {
      const { error } = await db().from("ai_chat_threads").update(patch).eq("id", id);
      if (error) fail("thread update", error);
    },

    async countInFlight(userId) {
      const since = new Date(Date.now() - STREAM_FRESH_SECONDS * 1_000).toISOString();
      const { count, error } = await db()
        .from("ai_chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .in("status", ["pending", "streaming"])
        .gte("updated_at", since);
      if (error) fail("in-flight count", error);
      return count ?? 0;
    },

    async loadAttachment(thread): Promise<AttachmentInput | null> {
      if (!thread.clipJobId) return null;
      const client = db();
      const { data: job } = await client
        .from("clip_jobs")
        .select("id,source_title")
        .eq("id", thread.clipJobId)
        .eq("workspace_id", thread.workspaceId)
        .maybeSingle();
      if (!job) return null;
      const [{ data: candidates }, { data: transcript }] = await Promise.all([
        client
          .from("clip_candidates")
          .select("title,hook,summary,start_seconds,end_seconds,rank")
          .eq("clip_job_id", job.id)
          .order("rank", { ascending: true })
          .limit(20),
        client
          .from("transcripts")
          .select("text")
          .eq("clip_job_id", job.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      return {
        kind: "clip_job",
        title: job.source_title ?? "Untitled source",
        candidates: (candidates ?? []).map((candidate) => ({
          title: candidate.title,
          hook: candidate.hook,
          summary: candidate.summary,
          startSeconds: candidate.start_seconds,
          endSeconds: candidate.end_seconds,
        })),
        transcript: transcript?.text ?? null,
      };
    },

    async modelLimits(credentialId, modelId) {
      const { data, error } = await db()
        .from("ai_model_cache")
        .select("models_json")
        .eq("credential_id", credentialId)
        .maybeSingle();
      if (error) fail("model lookup", error);
      if (!data || !Array.isArray(data.models_json)) return null;
      const model = (data.models_json as unknown as NormalizedModel[]).find(
        (item) => item.modelId === modelId,
      );
      return model ? { contextWindow: model.contextWindow, maxOutput: model.maxOutput } : null;
    },

    async reconcileStale(threadId, actor, olderThanIso) {
      const { data, error } = await db()
        .from("ai_chat_messages")
        .update({ status: "interrupted" })
        .eq("thread_id", threadId)
        .eq("user_id", actor.userId)
        .in("status", ["pending", "streaming"])
        .lt("updated_at", olderThanIso)
        .select("id");
      if (error) fail("stale reconcile", error);
      return data?.length ?? 0;
    },
  };
}
