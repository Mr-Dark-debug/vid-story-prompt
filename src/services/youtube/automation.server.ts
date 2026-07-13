import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getServerEnv } from "@/config/env.server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getCurrentSession } from "@/services/auth/server";
import { createClipJob } from "@/services/clipping/server";
import { automationRuleInputSchema } from "./integration.types";
import { deriveWebSubSecret, webSubSecretHash } from "./websub.server";

const RULE_ATTESTATION_VERSION = "youtube-automation-rights-v1";
const POLICY_VERSION = "vidrial-content-policy-v1";
const HUB_URL = "https://pubsubhubbub.appspot.com/subscribe";

async function updateHubSubscription(input: {
  youtubeChannelId: string;
  providerChannelId: string;
  workspaceId: string;
  enabled: boolean;
}) {
  const env = getServerEnv();
  if (!env.YOUTUBE_WEBHOOK_SECRET)
    throw new Error("YouTube automation requires YOUTUBE_WEBHOOK_SECRET.");
  const topic = `https://www.youtube.com/feeds/videos.xml?channel_id=${input.providerChannelId}`;
  const secret = deriveWebSubSecret(input.providerChannelId, env.YOUTUBE_WEBHOOK_SECRET);
  const admin = getSupabaseAdminClient();
  const { data: subscription, error } = await admin
    .from("youtube_subscriptions")
    .upsert(
      {
        workspace_id: input.workspaceId,
        youtube_channel_id: input.youtubeChannelId,
        hub_topic: topic,
        secret_hash: webSubSecretHash(secret),
        status: input.enabled ? "pending" : "disabled",
        last_renewal_attempt_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "youtube_channel_id" },
    )
    .select("id,callback_key")
    .single();
  if (error) throw new Error(error.message);
  const callback = new URL("/api/youtube/webhook", env.PUBLIC_APP_URL);
  callback.searchParams.set("key", subscription.callback_key);
  const response = await fetch(HUB_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      "hub.callback": callback.toString(),
      "hub.mode": input.enabled ? "subscribe" : "unsubscribe",
      "hub.topic": topic,
      "hub.verify": "async",
      "hub.lease_seconds": "864000",
      "hub.secret": secret,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (![202, 204].includes(response.status)) {
    await admin
      .from("youtube_subscriptions")
      .update({ status: "failed", last_error_code: `hub_${response.status}` })
      .eq("id", subscription.id);
    throw new Error("YouTube notification subscription could not be updated.");
  }
  return { status: input.enabled ? "pending" : "disabled" };
}

export const saveYouTubeAutomationRule = createServerFn({ method: "POST" })
  .validator(z.object({ youtubeChannelId: z.string().uuid(), rule: automationRuleInputSchema }))
  .handler(async ({ data }) => {
    const session = await getCurrentSession();
    if (!session?.workspaceId) throw new Error("Your session expired.");
    if (
      data.rule.enabled &&
      data.rule.sourceBehavior === "start_when_source_exists" &&
      !data.rule.rightsAccepted
    )
      throw new Error("Accept the automation rights statement before automatic processing.");
    const admin = getSupabaseAdminClient();
    const { data: channel } = await admin
      .from("youtube_channels")
      .select("id,workspace_id,user_id,provider_channel_id")
      .eq("id", data.youtubeChannelId)
      .eq("workspace_id", session.workspaceId)
      .eq("user_id", session.id)
      .maybeSingle();
    if (!channel) throw new Error("The selected YouTube channel is unavailable.");
    const acceptedAt = data.rule.rightsAccepted ? new Date().toISOString() : null;
    const { data: rule, error } = await admin
      .from("automation_rules")
      .upsert(
        {
          workspace_id: session.workspaceId,
          user_id: session.id,
          youtube_channel_id: channel.id,
          enabled: data.rule.enabled,
          source_behavior: data.rule.sourceBehavior,
          requested_clip_count: data.rule.requestedClipCount,
          duration_range: data.rule.durationRange,
          caption_preset: data.rule.captionPreset,
          content_type: data.rule.contentType,
          clip_settings_json: {},
          publishing_behavior: data.rule.publishingBehavior,
          default_privacy: data.rule.defaultPrivacy,
          timezone: data.rule.timezone,
          attestation_version: acceptedAt ? RULE_ATTESTATION_VERSION : null,
          policy_version: acceptedAt ? POLICY_VERSION : null,
          rights_accepted_at: acceptedAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "workspace_id,youtube_channel_id" },
      )
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    const subscription = await updateHubSubscription({
      youtubeChannelId: channel.id,
      providerChannelId: channel.provider_channel_id,
      workspaceId: session.workspaceId,
      enabled: data.rule.enabled,
    });
    return { rule, subscription };
  });

export const listYouTubeAutomationDrafts = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getCurrentSession();
  if (!session?.workspaceId) return [];
  const { data, error } = await getSupabaseAdminClient()
    .from("automation_drafts")
    .select("*")
    .eq("workspace_id", session.workspaceId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const attachSourceToAutomationDraft = createServerFn({ method: "POST" })
  .validator(
    z.object({
      draftId: z.string().uuid(),
      mediaAssetId: z.string().uuid(),
      rightsAccepted: z.literal(true),
    }),
  )
  .handler(async ({ data }) => {
    const session = await getCurrentSession();
    if (!session?.workspaceId) throw new Error("Your session expired.");
    const admin = getSupabaseAdminClient();
    const [{ data: draft }, { data: asset }] = await Promise.all([
      admin
        .from("automation_drafts")
        .select("*")
        .eq("id", data.draftId)
        .eq("workspace_id", session.workspaceId)
        .eq("user_id", session.id)
        .maybeSingle(),
      admin
        .from("media_assets")
        .select("id,duration_seconds,display_name")
        .eq("id", data.mediaAssetId)
        .eq("workspace_id", session.workspaceId)
        .eq("user_id", session.id)
        .maybeSingle(),
    ]);
    if (!draft || !asset?.duration_seconds)
      throw new Error("The automation draft or source asset is unavailable.");
    const { data: rule } = draft.automation_rule_id
      ? await admin
          .from("automation_rules")
          .select("*")
          .eq("id", draft.automation_rule_id)
          .maybeSingle()
      : { data: null };
    const result = await createClipJob({
      data: {
        sourceType: "youtube_connected_channel",
        sourceUrl: `https://www.youtube.com/watch?v=${draft.provider_video_id}`,
        sourceIdentifier: draft.provider_video_id,
        sourceDurationSeconds: Math.round(asset.duration_seconds),
        sourceAssetId: asset.id,
        sourceMetadata: {
          title: draft.title || asset.display_name,
          thumbnailUrl: draft.thumbnail_url ?? undefined,
        },
        settings: {
          durationRange: rule?.duration_range ?? "30-60 seconds",
          captionPreset: rule?.caption_preset ?? "Clean editorial",
          contentType: rule?.content_type ?? "Video",
          targetPlatforms: ["youtube_shorts"],
          aspectRatios: ["9:16"],
        },
        requestedClipCount: rule?.requested_clip_count ?? 5,
        rightsAccepted: true,
        idempotencyKey: crypto.randomUUID(),
      },
    });
    const { error: linkError } = await admin.from("youtube_asset_links").upsert(
      {
        workspace_id: session.workspaceId,
        user_id: session.id,
        youtube_channel_id: draft.youtube_channel_id,
        provider_video_id: draft.provider_video_id,
        media_asset_id: asset.id,
        provenance: "user_attached",
      },
      { onConflict: "workspace_id,provider_video_id" },
    );
    if (linkError) throw new Error(linkError.message);
    await admin
      .from("automation_drafts")
      .update({
        source_asset_id: asset.id,
        clip_job_id: result.jobId,
        status: "job_created",
        updated_at: new Date().toISOString(),
      })
      .eq("id", draft.id);
    return result;
  });
