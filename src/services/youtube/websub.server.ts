import { createHash, createHmac } from "node:crypto";
import { getServerEnv } from "@/config/env.server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { fetchYouTubeMetadataById } from "./server";
import { secureTextEqual } from "./token-crypto.server";
import { wakeVideoWorker } from "@/services/worker/server";

const MAX_NOTIFICATION_BYTES = 256 * 1024;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const CHANNEL_ID = /^UC[A-Za-z0-9_-]{20,30}$/;

function xmlValue(xml: string, name: string) {
  const match = xml.match(
    new RegExp(`<${name}>(?:<!\\[CDATA\\[)?([^<\\]]+)(?:\\]\\]>)?<\\/${name}>`, "i"),
  );
  return match?.[1]?.trim();
}

export function parseYouTubeNotification(xml: string) {
  if (Buffer.byteLength(xml, "utf8") > MAX_NOTIFICATION_BYTES)
    throw new Error("The YouTube notification is too large.");
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("Unsafe XML declarations are not accepted.");
  const videoId = xmlValue(xml, "yt:videoId");
  const channelId = xmlValue(xml, "yt:channelId");
  if (!videoId || !VIDEO_ID.test(videoId) || !channelId || !CHANNEL_ID.test(channelId))
    throw new Error("The YouTube notification identifiers are invalid.");
  return {
    videoId,
    channelId,
    title: xmlValue(xml, "title") ?? "Untitled YouTube upload",
    publishedAt: xmlValue(xml, "published") ?? null,
    updatedAt: xmlValue(xml, "updated") ?? null,
  };
}

export function deriveWebSubSecret(channelId: string, masterSecret: string) {
  return createHmac("sha256", masterSecret).update(`youtube:${channelId}`).digest("base64url");
}

export function webSubSecretHash(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export function verifyWebSubSignature(body: string, signature: string | null, secret: string) {
  if (!signature?.startsWith("sha1=")) return false;
  const expected = `sha1=${createHmac("sha1", secret).update(body).digest("hex")}`;
  return secureTextEqual(expected, signature);
}

export function channelIdFromTopic(topic: string) {
  try {
    const url = new URL(topic);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "www.youtube.com" ||
      url.pathname !== "/feeds/videos.xml"
    )
      return null;
    const channelId = url.searchParams.get("channel_id");
    return channelId && CHANNEL_ID.test(channelId) ? channelId : null;
  } catch {
    return null;
  }
}

export async function verifyWebSubChallenge(input: {
  callbackKey: string;
  topic: string;
  mode: string;
  leaseSeconds: number | null;
}) {
  const channelId = channelIdFromTopic(input.topic);
  if (!channelId || !["subscribe", "unsubscribe"].includes(input.mode)) return false;
  const admin = getSupabaseAdminClient();
  const { data: subscription } = await admin
    .from("youtube_subscriptions")
    .select("id,youtube_channel_id")
    .eq("callback_key", input.callbackKey)
    .eq("hub_topic", input.topic)
    .maybeSingle();
  if (!subscription) return false;
  const { data: channel } = await admin
    .from("youtube_channels")
    .select("provider_channel_id")
    .eq("id", subscription.youtube_channel_id)
    .maybeSingle();
  if (channel?.provider_channel_id !== channelId) return false;
  const now = new Date();
  const lease = Math.max(60, Math.min(input.leaseSeconds ?? 864_000, 1_296_000));
  const { error } = await admin
    .from("youtube_subscriptions")
    .update({
      status: input.mode === "subscribe" ? "verified" : "disabled",
      verified_at: now.toISOString(),
      lease_expires_at:
        input.mode === "subscribe" ? new Date(now.getTime() + lease * 1000).toISOString() : null,
      updated_at: now.toISOString(),
      last_error_code: null,
    })
    .eq("id", subscription.id);
  return !error;
}

export async function handleYouTubeNotification(input: {
  callbackKey: string;
  body: string;
  signature: string | null;
}) {
  const parsed = parseYouTubeNotification(input.body);
  const env = getServerEnv();
  if (!env.YOUTUBE_WEBHOOK_SECRET)
    throw new Error("YouTube webhook verification is not configured.");
  const secret = deriveWebSubSecret(parsed.channelId, env.YOUTUBE_WEBHOOK_SECRET);
  if (!verifyWebSubSignature(input.body, input.signature, secret))
    throw new Error("The YouTube notification signature is invalid.");

  const admin = getSupabaseAdminClient();
  const { data: subscription } = await admin
    .from("youtube_subscriptions")
    .select("youtube_channel_id,status")
    .eq("callback_key", input.callbackKey)
    .eq("status", "verified")
    .maybeSingle();
  if (!subscription) throw new Error("The YouTube subscription is not active.");
  const { data: channel } = await admin
    .from("youtube_channels")
    .select("id,workspace_id,user_id,provider_channel_id")
    .eq("id", subscription.youtube_channel_id)
    .maybeSingle();
  if (!channel || channel.provider_channel_id !== parsed.channelId)
    throw new Error("The YouTube notification channel did not match the subscription.");
  const { data: rule } = await admin
    .from("automation_rules")
    .select("*")
    .eq("youtube_channel_id", channel.id)
    .eq("enabled", true)
    .maybeSingle();
  if (!rule) return { accepted: true, action: "ignored" as const };

  const metadata = await fetchYouTubeMetadataById(parsed.videoId);
  const { data: existingDraft } = await admin
    .from("automation_drafts")
    .select("id")
    .eq("workspace_id", channel.workspace_id)
    .eq("provider_video_id", parsed.videoId)
    .maybeSingle();
  const eventKind = existingDraft ? "metadata_update" : "upload";
  const eventVersion = parsed.updatedAt ?? parsed.publishedAt ?? metadata.publishedAt;
  const eventKey = createHash("sha256")
    .update(`${channel.id}:${parsed.videoId}:${eventKind}:${eventVersion}`)
    .digest("hex");
  const { data: event, error: eventError } = await admin
    .from("automation_events")
    .upsert(
      {
        workspace_id: channel.workspace_id,
        youtube_channel_id: channel.id,
        automation_rule_id: rule.id,
        provider_event_key: eventKey,
        provider_video_id: parsed.videoId,
        event_kind: eventKind,
        payload_json: {
          title: metadata.title,
          channelTitle: metadata.channelTitle,
          publishedAt: metadata.publishedAt,
        },
        status: "received",
      },
      { onConflict: "provider_event_key" },
    )
    .select("id,status")
    .single();
  if (eventError) throw new Error(eventError.message);
  if (event.status !== "received") return { accepted: true, action: "duplicate" as const };

  const { data: draft, error: draftError } = await admin
    .from("automation_drafts")
    .upsert(
      {
        workspace_id: channel.workspace_id,
        user_id: channel.user_id,
        automation_rule_id: rule.id,
        youtube_channel_id: channel.id,
        provider_video_id: parsed.videoId,
        title: metadata.title,
        description: null,
        thumbnail_url: metadata.thumbnailUrl,
        duration_seconds: metadata.durationSeconds,
        published_at: metadata.publishedAt,
        proposed_settings_json: {
          requestedClipCount: rule.requested_clip_count,
          durationRange: rule.duration_range,
          captionPreset: rule.caption_preset,
          contentType: rule.content_type,
        },
        status: "awaiting_source",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,provider_video_id" },
    )
    .select("id,status")
    .single();
  if (draftError) throw new Error(draftError.message);
  await admin
    .from("automation_events")
    .update({
      automation_draft_id: draft.id,
      status: "draft_created",
      processed_at: new Date().toISOString(),
    })
    .eq("id", event.id);
  if (
    rule.source_behavior === "start_when_source_exists" &&
    rule.rights_accepted_at &&
    rule.attestation_version &&
    rule.policy_version
  ) {
    const { data: link } = await admin
      .from("youtube_asset_links")
      .select("media_asset_id")
      .eq("workspace_id", channel.workspace_id)
      .eq("youtube_channel_id", channel.id)
      .eq("provider_video_id", parsed.videoId)
      .maybeSingle();
    if (link) {
      const { data: clipJobId, error: jobError } = await admin.rpc("create_automated_clip_job", {
        p_rule_id: rule.id,
        p_draft_id: draft.id,
        p_source_asset_id: link.media_asset_id,
        p_idempotency_key: crypto.randomUUID(),
      });
      if (jobError) {
        await admin
          .from("automation_events")
          .update({
            status: "failed",
            error_code: "automated_job_failed",
            processed_at: new Date().toISOString(),
          })
          .eq("id", event.id);
        throw new Error(jobError.message);
      }
      await admin
        .from("automation_events")
        .update({
          status: "job_created",
          clip_job_id: clipJobId,
          processed_at: new Date().toISOString(),
        })
        .eq("id", event.id);
      await wakeVideoWorker();
      return { accepted: true, action: "job_created" as const, draftId: draft.id, clipJobId };
    }
  }
  return { accepted: true, action: "draft_created" as const, draftId: draft.id };
}
