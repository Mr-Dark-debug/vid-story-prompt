import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getCurrentSession } from "@/services/auth/server";
import { wakeVideoWorker } from "@/services/worker/server";
import { getServerEnv } from "@/config/env.server";
import { decryptSecret } from "@/services/youtube/token-crypto.server";
import { connectorEncryptionKey } from "./oauth.server";

export const socialPublishingPlatformSchema = z.enum([
  "facebook",
  "instagram",
  "tiktok",
  "linkedin",
]);
export type SocialPublishingPlatform = z.infer<typeof socialPublishingPlatformSchema>;

const providerByPlatform: Record<SocialPublishingPlatform, string> = {
  facebook: "meta_facebook",
  instagram: "meta_instagram",
  tiktok: "tiktok",
  linkedin: "linkedin",
};

const targetSchema = z.object({
  id: z.string().min(1).max(256),
  label: z.string().min(1).max(200),
  pageId: z.string().min(1).max(128).optional(),
});

export const socialPublishInputSchema = z.object({
  exportId: z.string().uuid(),
  platform: socialPublishingPlatformSchema,
  connectionId: z.string().uuid(),
  targetAccountId: z.string().min(1).max(256),
  title: z.string().trim().min(1).max(2200),
  caption: z.string().trim().max(5000).default(""),
  idempotencyKey: z.string().uuid(),
  reviewConfirmed: z.literal(true),
  options: z
    .object({
      privacyLevel: z
        .enum([
          "PUBLIC_TO_EVERYONE",
          "MUTUAL_FOLLOW_FRIENDS",
          "FOLLOWER_OF_CREATOR",
          "SELF_ONLY",
        ])
        .optional(),
      disableComment: z.boolean().optional(),
      disableDuet: z.boolean().optional(),
      disableStitch: z.boolean().optional(),
      shareToFeed: z.boolean().optional(),
    })
    .default({}),
});

export const listSocialPublishingDestinations = createServerFn({ method: "GET" }).handler(
  async () => {
    const session = await getCurrentSession();
    if (!session?.workspaceId) return [];
    const { data, error } = await getSupabaseAdminClient()
      .from("oauth_connections")
      .select("id,connector_id,provider,display_name,status,capabilities,metadata_json")
      .eq("workspace_id", session.workspaceId)
      .eq("user_id", session.id)
      .eq("status", "connected");
    if (error) throw new Error(error.message);
    return (data ?? []).flatMap((connection) => {
      const parsedPlatform = socialPublishingPlatformSchema.safeParse(connection.connector_id);
      if (!parsedPlatform.success || !connection.capabilities.includes("video_publish")) return [];
      const metadata = z
        .object({ targets: z.array(targetSchema).default([]) })
        .safeParse(connection.metadata_json);
      if (!metadata.success) return [];
      return [
        {
          connectionId: connection.id,
          platform: parsedPlatform.data,
          displayName: connection.display_name ?? parsedPlatform.data,
          targets: metadata.data.targets,
          constraints: {
            privateOnly:
              parsedPlatform.data === "tiktok" &&
              !getServerEnv().TIKTOK_CONTENT_POSTING_AUDITED,
          },
        },
      ];
    });
  },
);

export const getTikTokCreatorPostingOptions = createServerFn({ method: "POST" })
  .validator(z.object({ connectionId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const session = await getCurrentSession();
    if (!session?.workspaceId) throw new Error("Your session expired.");
    const { data: connection } = await getSupabaseAdminClient()
      .from("oauth_connections")
      .select("id,status,provider,access_token_encrypted")
      .eq("id", data.connectionId)
      .eq("workspace_id", session.workspaceId)
      .eq("user_id", session.id)
      .maybeSingle();
    if (
      !connection ||
      connection.provider !== "tiktok" ||
      connection.status !== "connected" ||
      !connection.access_token_encrypted
    )
      throw new Error("Reconnect TikTok before reviewing creator options.");
    const token = decryptSecret(connection.access_token_encrypted, connectorEncryptionKey());
    const response = await fetch(
      "https://open.tiktokapis.com/v2/post/publish/creator_info/query/",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json; charset=UTF-8",
        },
        body: "{}",
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) throw new Error("TikTok creator options could not be refreshed.");
    const creator = z
      .object({
        data: z.object({
          privacy_level_options: z.array(
            z.enum([
              "PUBLIC_TO_EVERYONE",
              "MUTUAL_FOLLOW_FRIENDS",
              "FOLLOWER_OF_CREATOR",
              "SELF_ONLY",
            ]),
          ),
          comment_disabled: z.boolean().optional(),
          duet_disabled: z.boolean().optional(),
          stitch_disabled: z.boolean().optional(),
        }),
      })
      .parse(await response.json()).data;
    return {
      privacyLevels: getServerEnv().TIKTOK_CONTENT_POSTING_AUDITED
        ? creator.privacy_level_options
        : creator.privacy_level_options.filter((option) => option === "SELF_ONLY"),
      commentDisabled: creator.comment_disabled ?? false,
      duetDisabled: creator.duet_disabled ?? false,
      stitchDisabled: creator.stitch_disabled ?? false,
      audited: getServerEnv().TIKTOK_CONTENT_POSTING_AUDITED,
    };
  });

export const createSocialPublishingJob = createServerFn({ method: "POST" })
  .validator(socialPublishInputSchema)
  .handler(async ({ data }) => {
    const session = await getCurrentSession();
    if (!session?.workspaceId) throw new Error("Your session expired.");
    const admin = getSupabaseAdminClient();
    const [{ data: exportItem }, { data: connection }] = await Promise.all([
      admin
        .from("exports")
        .select("id,clip_job_id,workspace_id,user_id,status,storage_bucket,storage_path")
        .eq("id", data.exportId)
        .eq("workspace_id", session.workspaceId)
        .eq("user_id", session.id)
        .maybeSingle(),
      admin
        .from("oauth_connections")
        .select("id,provider,connector_id,status,capabilities,metadata_json")
        .eq("id", data.connectionId)
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
    if (
      !connection ||
      connection.provider !== providerByPlatform[data.platform] ||
      connection.connector_id !== data.platform ||
      connection.status !== "connected" ||
      !connection.capabilities.includes("video_publish")
    )
      throw new Error(`Reconnect ${data.platform} and grant publishing access.`);
    const metadata = z
      .object({ targets: z.array(targetSchema) })
      .safeParse(connection.metadata_json);
    if (!metadata.success || !metadata.data.targets.some((target) => target.id === data.targetAccountId))
      throw new Error("Choose an authorised publishing destination from the connected account.");

    const { data: job, error } = await admin
      .from("publishing_jobs")
      .upsert(
        {
          workspace_id: session.workspaceId,
          user_id: session.id,
          clip_job_id: exportItem.clip_job_id,
          export_id: exportItem.id,
          youtube_channel_id: null,
          platform: data.platform,
          connection_id: connection.id,
          target_account_id: data.targetAccountId,
          title: data.title,
          caption: data.caption,
          description: data.caption,
          tags: [],
          category_id: "22",
          made_for_kids: false,
          privacy_status: data.platform === "tiktok" ? (data.options.privacyLevel ?? "SELF_ONLY") : "public",
          platform_options_json: data.options,
          approval_mode: "review_required",
          approved_at: new Date().toISOString(),
          status: "queued",
          idempotency_key: data.idempotencyKey,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "idempotency_key" },
      )
      .select("id,clip_job_id,status,platform")
      .single();
    if (error) throw new Error(error.message);
    const { error: taskError } = await admin.from("job_tasks").upsert(
      {
        clip_job_id: job.clip_job_id,
        task_type: "publish_social_video",
        status: "queued",
        priority: 10,
        input_json: { publishingJobId: job.id },
        output_json: {},
        idempotency_key: `${job.id}:${job.platform}-publish`,
        next_attempt_at: new Date().toISOString(),
      },
      { onConflict: "idempotency_key" },
    );
    if (taskError) throw new Error(taskError.message);
    const workerWake = await wakeVideoWorker();
    return { publishingJobId: job.id, status: job.status, platform: job.platform, workerWake };
  });

export const listSocialPublishingJobs = createServerFn({ method: "GET" })
  .validator(z.object({ clipJobId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const session = await getCurrentSession();
    if (!session?.workspaceId) return [];
    const { data: jobs, error } = await getSupabaseAdminClient()
      .from("publishing_jobs")
      .select("id,title,platform,status,provider_video_url,last_error_message,created_at")
      .eq("clip_job_id", data.clipJobId)
      .eq("workspace_id", session.workspaceId)
      .neq("platform", "youtube")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return jobs ?? [];
  });
