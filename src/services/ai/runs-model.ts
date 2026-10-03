import type { Database } from "@/lib/supabase/database.types";

type RunInsert = Database["public"]["Tables"]["ai_runs"]["Insert"] & { idempotency_key: string };

/**
 * Builds the queue rows for a batch of social-copy runs. The idempotency key is derived from the
 * batch and clip, so submitting the same batch twice never queues duplicate work.
 */
export function buildSocialCopyRunRows(input: {
  actor: { userId: string; workspaceId: string };
  clips: ReadonlyArray<{ clipId: string; clipJobId: string }>;
  batchId: string;
  model: { credentialId: string; modelId: string } | null;
}): RunInsert[] {
  return input.clips.map(({ clipId, clipJobId }) => ({
    workspace_id: input.actor.workspaceId,
    user_id: input.actor.userId,
    purpose: "social_copy",
    clip_job_id: clipJobId,
    credential_id: input.model?.credentialId ?? null,
    model_id: input.model?.modelId ?? null,
    // Reference only: the worker loads the clip itself, scoped to this workspace.
    input_json: { clipId },
    idempotency_key: `social_copy:${input.batchId}:${clipId}`,
  }));
}
