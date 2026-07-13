import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getCurrentSession } from "@/services/auth/server";
import { wakeVideoWorker } from "@/services/worker/server";
import { publishInputSchema } from "./integration.types";

export const createYouTubePublishingJob = createServerFn({ method: "POST" })
  .validator(publishInputSchema)
  .handler(async ({ data }) => {
    const session = await getCurrentSession();
    if (!session?.workspaceId) throw new Error("Your session expired.");
    const admin = getSupabaseAdminClient();
    const [{ data: exportItem }, { data: channel }] = await Promise.all([
      admin
        .from("exports")
        .select("id,clip_job_id,workspace_id,user_id,status,storage_bucket,storage_path")
        .eq("id", data.exportId)
        .eq("workspace_id", session.workspaceId)
        .eq("user_id", session.id)
        .maybeSingle(),
      admin
        .from("youtube_channels")
        .select("id,connection_id,workspace_id,user_id")
        .eq("id", data.youtubeChannelId)
        .eq("workspace_id", session.workspaceId)
        .eq("user_id", session.id)
        .maybeSingle(),
    ]);
    if (
      !exportItem ||
      exportItem.status !== "complete" ||
      !exportItem.storage_bucket ||
      !exportItem.storage_path
    )
      throw new Error("Choose a completed video export before publishing.");
    if (!channel) throw new Error("The destination YouTube channel is unavailable.");
    const { data: connection } = await admin
      .from("oauth_connections")
      .select("status,capabilities")
      .eq("id", channel.connection_id)
      .maybeSingle();
    if (connection?.status !== "connected") throw new Error("Reconnect YouTube before publishing.");
    if (!connection.capabilities.includes("video_publish"))
      throw new Error("Grant YouTube publishing access before continuing.");
    if (data.scheduledFor && new Date(data.scheduledFor).getTime() <= Date.now())
      throw new Error("Choose a future publishing time.");
    const status = data.scheduledFor ? "scheduled" : "queued";
    const { data: job, error } = await admin
      .from("publishing_jobs")
      .upsert(
        {
          workspace_id: session.workspaceId,
          user_id: session.id,
          clip_job_id: exportItem.clip_job_id,
          export_id: exportItem.id,
          youtube_channel_id: channel.id,
          title: data.title,
          description: data.description,
          tags: data.tags,
          category_id: data.categoryId,
          made_for_kids: data.madeForKids,
          privacy_status: data.privacyStatus,
          scheduled_for: data.scheduledFor,
          status,
          idempotency_key: data.idempotencyKey,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "idempotency_key" },
      )
      .select("id,clip_job_id,status")
      .single();
    if (error) throw new Error(error.message);
    const { error: taskError } = await admin.from("job_tasks").upsert(
      {
        clip_job_id: job.clip_job_id,
        task_type: "publish_youtube_video",
        status: "queued",
        priority: 10,
        input_json: { publishingJobId: job.id },
        output_json: {},
        idempotency_key: `${job.id}:youtube-publish`,
        next_attempt_at: data.scheduledFor ?? new Date().toISOString(),
      },
      { onConflict: "idempotency_key" },
    );
    if (taskError) throw new Error(taskError.message);
    const workerWake = await wakeVideoWorker();
    return { publishingJobId: job.id, status: job.status, workerWake };
  });

export const listYouTubePublishingJobs = createServerFn({ method: "GET" })
  .validator(z.object({ clipJobId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const session = await getCurrentSession();
    if (!session?.workspaceId) return [];
    const { data: jobs, error } = await getSupabaseAdminClient()
      .from("publishing_jobs")
      .select("*")
      .eq("clip_job_id", data.clipJobId)
      .eq("workspace_id", session.workspaceId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return jobs ?? [];
  });

export const cancelYouTubePublishingJob = createServerFn({ method: "POST" })
  .validator(z.object({ publishingJobId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const session = await getCurrentSession();
    if (!session?.workspaceId) throw new Error("Your session expired.");
    const admin = getSupabaseAdminClient();
    const { error } = await admin
      .from("publishing_jobs")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", data.publishingJobId)
      .eq("workspace_id", session.workspaceId)
      .in("status", ["scheduled", "queued", "retry_wait"]);
    if (error) throw new Error(error.message);
    await admin
      .from("job_tasks")
      .update({ status: "cancelled", completed_at: new Date().toISOString() })
      .eq("input_json->>publishingJobId", data.publishingJobId)
      .in("status", ["pending", "queued", "retry_wait"]);
    return { ok: true };
  });
