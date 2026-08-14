import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { Readable } from "node:stream";
import { z } from "zod";
import { env } from "../config/env.js";
import { TaskFailure, type ClipTask, type TaskResult } from "../domain/types.js";
import { decryptSecret, encryptSecret } from "../security/token-crypto.js";
import { downloadAsset, supabase } from "../storage/client.js";
import { withTaskDirectory } from "./context.js";

const platformSchema = z.enum(["facebook", "instagram", "tiktok", "linkedin"]);
const uuid = z.string().uuid();
type Platform = z.infer<typeof platformSchema>;
type Row = Record<string, unknown>;

const accessTokenResponseSchema = z.object({
  access_token: z.string().min(8),
  expires_in: z.number().int().positive().optional(),
  refresh_token: z.string().min(8).optional(),
  scope: z.string().optional(),
});

export function linkedinHeaders(token: string) {
  return {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "linkedin-version": env.LINKEDIN_API_VERSION,
    "x-restli-protocol-version": "2.0.0",
  };
}

export function tiktokPostBody(job: Row, privacyLevel: string) {
  const options = z
    .object({
      disableComment: z.boolean().default(false),
      disableDuet: z.boolean().default(false),
      disableStitch: z.boolean().default(false),
    })
    .parse(job.platform_options_json ?? {});
  return {
    post_info: {
      title: String(job.caption || job.title).slice(0, 2200),
      privacy_level: privacyLevel,
      disable_comment: options.disableComment,
      disable_duet: options.disableDuet,
      disable_stitch: options.disableStitch,
    },
  };
}

function providerConfig(platform: Platform) {
  if (!env.CONNECTOR_TOKEN_ENCRYPTION_KEY)
    throw new TaskFailure(
      "social_publishing_not_configured",
      "Social publishing token encryption is not configured on the worker.",
      false,
    );
  if (
    (platform === "facebook" || platform === "instagram") &&
    (!env.META_APP_ID || !env.META_APP_SECRET)
  )
    throw new TaskFailure("meta_not_configured", "Meta publishing is not configured.", false);
  if (platform === "tiktok" && (!env.TIKTOK_CLIENT_KEY || !env.TIKTOK_CLIENT_SECRET))
    throw new TaskFailure("tiktok_not_configured", "TikTok publishing is not configured.", false);
  if (platform === "linkedin" && (!env.LINKEDIN_CLIENT_ID || !env.LINKEDIN_CLIENT_SECRET))
    throw new TaskFailure("linkedin_not_configured", "LinkedIn publishing is not configured.", false);
  return { encryptionKey: env.CONNECTOR_TOKEN_ENCRYPTION_KEY };
}

async function markConnectionForReconnect(connectionId: string, code: string) {
  await supabase
    .from("oauth_connections")
    .update({ status: "reconnect_required", last_error_code: code, updated_at: new Date().toISOString() })
    .eq("id", connectionId);
}

async function connectorAccessToken(platform: Platform, connection: Row) {
  const { encryptionKey } = providerConfig(platform);
  const envelope = typeof connection.access_token_encrypted === "string" ? connection.access_token_encrypted : null;
  const expiresAt = Date.parse(String(connection.token_expires_at ?? ""));
  if (envelope && (!Number.isFinite(expiresAt) || expiresAt > Date.now() + 120_000))
    return decryptSecret(envelope, encryptionKey);
  const refreshEnvelope =
    typeof connection.refresh_token_encrypted === "string" ? connection.refresh_token_encrypted : null;
  if (platform !== "tiktok" || !refreshEnvelope) {
    await markConnectionForReconnect(String(connection.id), `${platform}_token_expired`);
    throw new TaskFailure(
      `${platform}_reconnect_required`,
      `Reconnect ${platform} before publishing.`,
      false,
    );
  }
  const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: env.TIKTOK_CLIENT_KEY!,
      client_secret: env.TIKTOK_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: decryptSecret(refreshEnvelope, encryptionKey),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    await markConnectionForReconnect(String(connection.id), "tiktok_refresh_rejected");
    throw new TaskFailure("tiktok_reconnect_required", "Reconnect TikTok before publishing.", false);
  }
  const tokens = accessTokenResponseSchema.parse(await response.json());
  await supabase
    .from("oauth_connections")
    .update({
      access_token_encrypted: encryptSecret(tokens.access_token, encryptionKey),
      refresh_token_encrypted: tokens.refresh_token
        ? encryptSecret(tokens.refresh_token, encryptionKey)
        : refreshEnvelope,
      token_expires_at: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        : null,
      scopes: tokens.scope?.split(/[ ,]+/).filter(Boolean) ?? connection.scopes,
      last_refreshed_at: new Date().toISOString(),
      last_error_code: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", String(connection.id));
  return tokens.access_token;
}

async function updateJob(id: string, values: Row) {
  const { error } = await supabase
    .from("publishing_jobs")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

function providerFailure(platform: Platform, operation: string, response: Response): never {
  if (response.status === 401 || response.status === 403)
    throw new TaskFailure(
      `${platform}_reconnect_required`,
      `Reconnect ${platform} and confirm publishing access.`,
      false,
    );
  throw new TaskFailure(
    `${platform}_${operation}_failed`,
    `${platform} could not complete ${operation}.`,
    response.status === 429 || response.status >= 500,
  );
}

function fileBody(file: string, start?: number, end?: number) {
  return Readable.toWeb(createReadStream(file, { start, end })) as never;
}

async function metaPageToken(connection: Row, accessToken: string, targetAccountId: string) {
  const metadata = z
    .object({
      targets: z.array(
        z.object({ id: z.string(), pageId: z.string().optional(), label: z.string().optional() }),
      ),
    })
    .parse(connection.metadata_json);
  const target = metadata.targets.find((item) => item.id === targetAccountId);
  if (!target) throw new TaskFailure("meta_target_missing", "Choose an authorised Meta destination.", false);
  const response = await fetch(
    `https://graph.facebook.com/${env.META_GRAPH_VERSION}/me/accounts?fields=id,access_token,instagram_business_account{id}`,
    { headers: { authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10_000) },
  );
  if (!response.ok) providerFailure("facebook", "destination_lookup", response);
  const pages = z
    .object({
      data: z.array(
        z.object({
          id: z.string(),
          access_token: z.string(),
          instagram_business_account: z.object({ id: z.string() }).optional(),
        }),
      ),
    })
    .parse(await response.json()).data;
  const page = pages.find((item) => item.id === (target.pageId ?? targetAccountId));
  if (!page) throw new TaskFailure("meta_target_unavailable", "The selected Meta destination is unavailable.", false);
  return { pageId: page.id, pageToken: page.access_token };
}

async function publishFacebook(job: Row, connection: Row, file: string, size: number, token: string) {
  const { pageId, pageToken } = await metaPageToken(connection, token, String(job.target_account_id));
  let videoId = typeof job.provider_video_id === "string" ? job.provider_video_id : null;
  const options = (job.platform_options_json ?? {}) as Row;
  let uploadUrl = videoId
    ? `https://rupload.facebook.com/video-upload/${env.META_GRAPH_VERSION}/${videoId}`
    : null;
  if (!videoId) {
    const start = await fetch(
      `https://graph.facebook.com/${env.META_GRAPH_VERSION}/${pageId}/video_reels?upload_phase=start`,
      { method: "POST", headers: { authorization: `Bearer ${pageToken}` }, signal: AbortSignal.timeout(20_000) },
    );
    if (!start.ok) providerFailure("facebook", "upload_start", start);
    const initialized = z.object({ video_id: z.string(), upload_url: z.string().url() }).parse(await start.json());
    videoId = initialized.video_id;
    uploadUrl = initialized.upload_url;
    await updateJob(String(job.id), { provider_video_id: videoId, status: "uploading" });
  }
  if (options._providerStage !== "uploaded") {
    const upload = await fetch(uploadUrl!, {
      method: "POST",
      headers: { authorization: `OAuth ${pageToken}`, offset: "0", file_size: String(size) },
      body: fileBody(file),
      duplex: "half",
      signal: AbortSignal.timeout(6 * 60 * 60_000),
    } as RequestInit & { duplex: "half" });
    if (!upload.ok) providerFailure("facebook", "upload", upload);
    if (!z.object({ success: z.literal(true) }).safeParse(await upload.json()).success)
      throw new TaskFailure("facebook_upload_failed", "Facebook did not accept the Reel upload.", false);
    await updateJob(String(job.id), {
      platform_options_json: { ...options, _providerStage: "uploaded" },
      status: "processing",
    });
  }
  const params = new URLSearchParams({
    upload_phase: "finish",
    video_id: videoId,
    video_state: "PUBLISHED",
    title: String(job.title),
    description: String(job.caption || job.description || ""),
  });
  const finish = await fetch(
    `https://graph.facebook.com/${env.META_GRAPH_VERSION}/${pageId}/video_reels?${params}`,
    { method: "POST", headers: { authorization: `Bearer ${pageToken}` }, signal: AbortSignal.timeout(20_000) },
  );
  if (!finish.ok) providerFailure("facebook", "publish", finish);
  if (!z.object({ success: z.literal(true) }).safeParse(await finish.json()).success)
    throw new TaskFailure("facebook_publish_failed", "Facebook did not accept the Reel.", false);
  return { id: videoId, url: `https://www.facebook.com/reel/${videoId}` };
}

async function publishInstagram(job: Row, connection: Row, token: string, bucket: string, path: string) {
  const target = String(job.target_account_id);
  const { pageToken } = await metaPageToken(connection, token, target);
  let containerId = typeof job.provider_video_id === "string" ? job.provider_video_id : null;
  if (!containerId) {
    const { data: signed, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
    if (error || !signed?.signedUrl)
      throw new TaskFailure("instagram_export_unavailable", "The export could not be prepared for Instagram.", true);
    const options = z.object({ shareToFeed: z.boolean().default(true) }).parse(job.platform_options_json ?? {});
    const body = new URLSearchParams({
      media_type: "REELS",
      video_url: signed.signedUrl,
      caption: String(job.caption || job.title),
      share_to_feed: String(options.shareToFeed),
    });
    const create = await fetch(
      `https://graph.facebook.com/${env.META_GRAPH_VERSION}/${target}/media`,
      { method: "POST", headers: { authorization: `Bearer ${pageToken}`, "content-type": "application/x-www-form-urlencoded" }, body, signal: AbortSignal.timeout(20_000) },
    );
    if (!create.ok) providerFailure("instagram", "container_create", create);
    containerId = z.object({ id: z.string() }).parse(await create.json()).id;
    await updateJob(String(job.id), { provider_video_id: containerId, status: "processing" });
  }
  let ready = false;
  for (let attempt = 0; attempt < 24; attempt++) {
    const status = await fetch(
      `https://graph.facebook.com/${env.META_GRAPH_VERSION}/${containerId}?fields=status_code`,
      { headers: { authorization: `Bearer ${pageToken}` }, signal: AbortSignal.timeout(10_000) },
    );
    if (!status.ok) providerFailure("instagram", "container_status", status);
    const code = z.object({ status_code: z.string() }).parse(await status.json()).status_code;
    if (code === "FINISHED") { ready = true; break; }
    if (code === "ERROR" || code === "EXPIRED")
      throw new TaskFailure("instagram_processing_failed", "Instagram could not process the Reel.", false);
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  if (!ready) throw new TaskFailure("instagram_processing_pending", "Instagram is still processing the Reel.", true);
  const publish = await fetch(
    `https://graph.facebook.com/${env.META_GRAPH_VERSION}/${target}/media_publish`,
    { method: "POST", headers: { authorization: `Bearer ${pageToken}`, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ creation_id: containerId }), signal: AbortSignal.timeout(20_000) },
  );
  if (!publish.ok) providerFailure("instagram", "publish", publish);
  const mediaId = z.object({ id: z.string() }).parse(await publish.json()).id;
  return { id: mediaId, url: `https://www.instagram.com/p/${mediaId}/` };
}

async function publishTikTok(job: Row, file: string, size: number, token: string) {
  const creatorResponse = await fetch(
    "https://open.tiktokapis.com/v2/post/publish/creator_info/query/",
    { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json; charset=UTF-8" }, body: "{}", signal: AbortSignal.timeout(10_000) },
  );
  if (!creatorResponse.ok) providerFailure("tiktok", "creator_lookup", creatorResponse);
  const creator = z
    .object({ data: z.object({ privacy_level_options: z.array(z.string()) }) })
    .parse(await creatorResponse.json()).data;
  const requested = String(job.privacy_status || "SELF_ONLY");
  const privacy = env.TIKTOK_CONTENT_POSTING_AUDITED ? requested : "SELF_ONLY";
  if (!creator.privacy_level_options.includes(privacy))
    throw new TaskFailure("tiktok_privacy_unavailable", "Choose a privacy option allowed by this TikTok account.", false);
  const { encryptionKey } = providerConfig("tiktok");
  let publishId = typeof job.provider_video_id === "string" ? job.provider_video_id : null;
  let uploadUrl =
    typeof job.resumable_session_encrypted === "string"
      ? decryptSecret(job.resumable_session_encrypted, encryptionKey)
      : null;
  if (!publishId) {
    const init = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json; charset=UTF-8" },
      body: JSON.stringify({
        ...tiktokPostBody(job, privacy),
        source_info: { source: "FILE_UPLOAD", video_size: size, chunk_size: size, total_chunk_count: 1 },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!init.ok) providerFailure("tiktok", "upload_start", init);
    const initialized = z
      .object({ data: z.object({ publish_id: z.string(), upload_url: z.string().url() }) })
      .parse(await init.json()).data;
    publishId = initialized.publish_id;
    uploadUrl = initialized.upload_url;
    await updateJob(String(job.id), {
      provider_video_id: publishId,
      resumable_session_encrypted: encryptSecret(uploadUrl, encryptionKey),
      status: "uploading",
    });
  }
  if (uploadUrl) {
    const upload = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "content-type": "video/mp4", "content-length": String(size), "content-range": `bytes 0-${size - 1}/${size}` },
      body: fileBody(file),
      duplex: "half",
      signal: AbortSignal.timeout(6 * 60 * 60_000),
    } as RequestInit & { duplex: "half" });
    if (!upload.ok) providerFailure("tiktok", "upload", upload);
    await updateJob(String(job.id), { resumable_session_encrypted: null, status: "processing" });
  }
  let state = "PROCESSING_UPLOAD";
  for (let attempt = 0; attempt < 24 && !["PUBLISH_COMPLETE", "FAILED"].includes(state); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 5_000));
    const status = await fetch("https://open.tiktokapis.com/v2/post/publish/status/fetch/", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ publish_id: publishId }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!status.ok) providerFailure("tiktok", "status", status);
    state = z.object({ data: z.object({ status: z.string() }) }).parse(await status.json()).data.status;
  }
  if (state === "FAILED") throw new TaskFailure("tiktok_processing_failed", "TikTok could not process the video.", false);
  return { id: publishId, url: null, processing: state !== "PUBLISH_COMPLETE" };
}

async function publishLinkedIn(job: Row, file: string, size: number, token: string) {
  const headers = linkedinHeaders(token);
  const owner = String(job.target_account_id);
  const { encryptionKey } = providerConfig("linkedin");
  const sessionSchema = z.object({
    video: z.string(),
    uploadToken: z.string(),
    uploadInstructions: z.array(
      z.object({ uploadUrl: z.string().url(), firstByte: z.number().int(), lastByte: z.number().int() }),
    ).min(1),
  });
  let video = typeof job.provider_video_id === "string" ? job.provider_video_id : null;
  let uploadSession =
    typeof job.resumable_session_encrypted === "string"
      ? sessionSchema.parse(
          JSON.parse(decryptSecret(job.resumable_session_encrypted, encryptionKey)),
        )
      : null;
  if (!video) {
    const init = await fetch("https://api.linkedin.com/rest/videos?action=initializeUpload", {
      method: "POST",
      headers,
      body: JSON.stringify({ initializeUploadRequest: { owner, fileSizeBytes: size, uploadCaptions: false, uploadThumbnail: false } }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!init.ok) providerFailure("linkedin", "upload_start", init);
    uploadSession = z.object({ value: sessionSchema }).parse(await init.json()).value;
    video = uploadSession.video;
    await updateJob(String(job.id), {
      provider_video_id: video,
      resumable_session_encrypted: encryptSecret(JSON.stringify(uploadSession), encryptionKey),
      status: "uploading",
    });
  }
  if (uploadSession) {
    const partIds: string[] = [];
    for (const part of uploadSession.uploadInstructions) {
      const lastByte = Math.min(part.lastByte, size - 1);
      const upload = await fetch(part.uploadUrl, {
        method: "PUT",
        headers: { "content-type": "application/octet-stream", "content-length": String(lastByte - part.firstByte + 1) },
        body: fileBody(file, part.firstByte, lastByte),
        duplex: "half",
        signal: AbortSignal.timeout(6 * 60 * 60_000),
      } as RequestInit & { duplex: "half" });
      if (!upload.ok) providerFailure("linkedin", "upload", upload);
      const etag = upload.headers.get("etag");
      if (!etag) throw new TaskFailure("linkedin_upload_receipt_missing", "LinkedIn did not return an upload receipt.", true);
      partIds.push(etag.replace(/^"|"$/g, ""));
    }
    const finalize = await fetch("https://api.linkedin.com/rest/videos?action=finalizeUpload", {
      method: "POST",
      headers,
      body: JSON.stringify({ finalizeUploadRequest: { video, uploadToken: uploadSession.uploadToken, uploadedPartIds: partIds } }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!finalize.ok) providerFailure("linkedin", "upload_finalize", finalize);
    await updateJob(String(job.id), { resumable_session_encrypted: null, status: "processing" });
  }
  const post = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers,
    body: JSON.stringify({
      author: owner,
      commentary: String(job.caption || job.description || ""),
      visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      content: { media: { title: String(job.title), id: video } },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!post.ok) providerFailure("linkedin", "publish", post);
  const postId = post.headers.get("x-restli-id");
  if (!postId) throw new TaskFailure("linkedin_publish_receipt_missing", "LinkedIn did not return a post receipt.", true);
  return { id: postId, url: `https://www.linkedin.com/feed/update/${encodeURIComponent(postId)}` };
}

export async function publishSocialVideo(task: ClipTask): Promise<TaskResult> {
  return withTaskDirectory(task, async (directory) => {
    const publishingJobId = uuid.parse(task.input_json.publishingJobId);
    const { data: job, error: jobError } = await supabase.from("publishing_jobs").select("*").eq("id", publishingJobId).single();
    if (jobError) throw jobError;
    const platform = platformSchema.parse(job.platform);
    providerConfig(platform);
    if (job.status === "cancelled") return { output: { cancelled: true }, message: "Publishing was cancelled." };
    if (job.status === "published") return { output: { publicationId: job.provider_video_id, alreadyPublished: true }, message: "This publication is already complete." };
    if (job.approval_mode === "review_required" && !job.approved_at)
      throw new TaskFailure("publish_review_required", "Review and approve this publication before sending it.", false);
    const [{ data: exportItem, error: exportError }, { data: connection, error: connectionError }] = await Promise.all([
      supabase.from("exports").select("*").eq("id", job.export_id).single(),
      supabase.from("oauth_connections").select("*").eq("id", job.connection_id).single(),
    ]);
    if (exportError) throw exportError;
    if (connectionError) throw connectionError;
    if (!exportItem.storage_bucket || !exportItem.storage_path)
      throw new TaskFailure("social_export_missing", "The completed export is unavailable.", false);
    if (connection.status !== "connected" || !Array.isArray(connection.capabilities) || !connection.capabilities.includes("video_publish"))
      throw new TaskFailure(`${platform}_reconnect_required`, `Reconnect ${platform} before publishing.`, false);
    try {
      const token = await connectorAccessToken(platform, connection as Row);
      const file = join(directory, basename(exportItem.storage_path));
      await downloadAsset(exportItem.storage_bucket, exportItem.storage_path, file);
      const size = (await stat(file)).size;
      await updateJob(job.id, { status: "uploading", started_at: job.started_at ?? new Date().toISOString() });
      const publication =
        platform === "facebook"
          ? await publishFacebook(job as Row, connection as Row, file, size, token)
          : platform === "instagram"
            ? await publishInstagram(job as Row, connection as Row, token, exportItem.storage_bucket, exportItem.storage_path)
            : platform === "tiktok"
              ? await publishTikTok(job as Row, file, size, token)
              : await publishLinkedIn(job as Row, file, size, token);
      const finalStatus = "processing" in publication && publication.processing ? "processing" : "published";
      await updateJob(job.id, {
        provider_video_id: publication.id,
        provider_video_url: publication.url,
        status: finalStatus,
        completed_at: finalStatus === "published" ? new Date().toISOString() : null,
        last_error_code: null,
        last_error_message: null,
      });
      return {
        output: { platform, publicationId: publication.id, providerState: finalStatus },
        message: finalStatus === "published" ? `Video published to ${platform}.` : `${platform} is processing the video.`,
      };
    } catch (cause) {
      const failure = cause instanceof TaskFailure ? cause : null;
      const reconnect = failure?.code.endsWith("_reconnect_required");
      await updateJob(job.id, {
        status: reconnect ? "reconnect_required" : failure?.retryable ? "retry_wait" : "failed",
        last_error_code: failure?.code ?? "social_publish_failed",
        last_error_message: failure?.message ?? "The provider could not complete publishing.",
      });
      throw cause;
    }
  });
}
