import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getServerEnv } from "@/config/env.server";
import { resolveAiModel } from "@/domain/ai/resolution";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentSession } from "@/services/auth/server";
import { wakeVideoWorker } from "@/services/worker/server";
import { createSupabaseResolutionStore } from "./resolve.server";
import { buildSocialCopyRunRows } from "./runs-model";

async function requireActor() {
  const session = await getCurrentSession();
  if (!session?.workspaceId) throw new Error("Sign in to use AI features.");
  return { userId: session.id, workspaceId: session.workspaceId };
}

const modelChoice = z.object({
  credentialId: z.string().uuid(),
  modelId: z.string().min(1).max(200),
});

/**
 * Queues one durable social-copy run per clip. Runs survive closing the tab: the worker claims
 * them from the leased queue, and the page watches their status through Realtime.
 */
export const enqueueSocialCopyRuns = createServerFn({ method: "POST" })
  .validator(
    z.object({
      clipIds: z.array(z.string().uuid()).min(1).max(20),
      // Identifies this click so a retry or double submit cannot queue the work twice.
      batchId: z.string().uuid(),
      model: modelChoice.optional(),
    }),
  )
  .handler(async ({ data }) => {
    const actor = await requireActor();
    const clipIds = [...new Set(data.clipIds)];

    // Row-level security limits this to clips in the caller's own workspace.
    const { data: visible, error } = await getSupabaseServerClient()
      .from("clips")
      .select("id,clip_job_id")
      .in("id", clipIds)
      .is("deleted_at", null);
    if (error) throw new Error("Those clips could not be checked.");
    if ((visible ?? []).length !== clipIds.length) {
      throw new Error("One or more clips are not available in your workspace.");
    }

    // Fail early, in plain words, instead of queueing work that cannot run.
    const store = createSupabaseResolutionStore();
    const preference = await store.preference(actor, "social_copy");
    const ids = [data.model?.credentialId, preference?.credentialId].filter(Boolean) as string[];
    const env = getServerEnv();
    const resolution = resolveAiModel({
      purpose: "social_copy",
      explicit: data.model ?? null,
      preference,
      credentials: await store.snapshots(actor, ids),
      platformAvailable: Boolean(env.OPENROUTER_API_KEY && env.OPENROUTER_CLIP_MODEL),
    });
    if (resolution.source === "deterministic") {
      throw new Error(
        resolution.skipped.length
          ? "Your selected AI key is not usable. Reconnect it in AI providers settings."
          : "Connect a provider key or choose a default model for social copy in AI providers settings.",
      );
    }

    const rows = buildSocialCopyRunRows({
      actor,
      clips: (visible ?? []).map((clip) => ({ clipId: clip.id, clipJobId: clip.clip_job_id })),
      batchId: data.batchId,
      model: data.model ?? null,
    });
    const admin = getSupabaseAdminClient();
    const { error: insertError } = await admin
      .from("ai_runs")
      .upsert(rows, { onConflict: "workspace_id,idempotency_key", ignoreDuplicates: true });
    if (insertError) throw new Error("The copy requests could not be queued.");
    const { data: queued, error: readError } = await admin
      .from("ai_runs")
      .select("id,input_json")
      .eq("workspace_id", actor.workspaceId)
      .eq("user_id", actor.userId)
      .in(
        "idempotency_key",
        rows.map((row) => row.idempotency_key),
      );
    if (readError) throw new Error("The copy requests could not be confirmed.");
    await wakeVideoWorker();
    return {
      runs: (queued ?? []).map((run) => ({
        id: run.id,
        clipId: String((run.input_json as { clipId?: string } | null)?.clipId ?? ""),
      })),
    };
  });

export const cancelAiRun = createServerFn({ method: "POST" })
  .validator(z.object({ runId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const actor = await requireActor();
    const admin = getSupabaseAdminClient() as unknown as {
      rpc(
        name: string,
        args: Record<string, unknown>,
      ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
    };
    const { data: cancelled, error } = await admin.rpc("cancel_ai_run", {
      p_run_id: data.runId,
      p_user_id: actor.userId,
    });
    if (error) throw new Error("The run could not be cancelled.");
    return { cancelled: cancelled === true };
  });
