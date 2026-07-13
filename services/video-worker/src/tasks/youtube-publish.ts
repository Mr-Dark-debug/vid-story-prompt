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

const uuid = z.string().uuid();
const tokenSchema = z.object({
  access_token: z.string(),
  expires_in: z.number().int().positive(),
  refresh_token: z.string().optional(),
  scope: z.string().optional(),
});

function requireGoogleConfig() {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY)
    throw new TaskFailure(
      "youtube_not_configured",
      "YouTube publishing is not configured on the worker.",
      false,
    );
  return {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    encryptionKey: env.GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY,
  };
}

async function accessToken(connection: Record<string, unknown>) {
  const config = requireGoogleConfig();
  const expiresAt = Date.parse(String(connection.token_expires_at ?? ""));
  const accessEnvelope =
    typeof connection.access_token_encrypted === "string"
      ? connection.access_token_encrypted
      : null;
  if (accessEnvelope && Number.isFinite(expiresAt) && expiresAt > Date.now() + 120_000)
    return decryptSecret(accessEnvelope, config.encryptionKey);
  const refreshEnvelope =
    typeof connection.refresh_token_encrypted === "string"
      ? connection.refresh_token_encrypted
      : null;
  if (!refreshEnvelope)
    throw new TaskFailure(
      "youtube_reconnect_required",
      "Reconnect YouTube before publishing.",
      false,
    );
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: decryptSecret(refreshEnvelope, config.encryptionKey),
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    await supabase
      .from("oauth_connections")
      .update({ status: "reconnect_required", last_error_code: `refresh_${response.status}` })
      .eq("id", String(connection.id));
    throw new TaskFailure(
      "youtube_reconnect_required",
      "Reconnect YouTube before publishing.",
      false,
    );
  }
  const token = tokenSchema.parse(await response.json());
  const { error } = await supabase
    .from("oauth_connections")
    .update({
      access_token_encrypted: encryptSecret(token.access_token, config.encryptionKey),
      refresh_token_encrypted: token.refresh_token
        ? encryptSecret(token.refresh_token, config.encryptionKey)
        : refreshEnvelope,
      token_expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
      scopes: token.scope?.split(" ") ?? connection.scopes,
      status: "connected",
      last_refreshed_at: new Date().toISOString(),
      last_error_code: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", String(connection.id));
  if (error) throw error;
  return token.access_token;
}

async function initiateUpload(
  job: Record<string, unknown>,
  token: string,
  size: number,
  encryptionKey: string,
) {
  const response = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json; charset=UTF-8",
        "x-upload-content-length": String(size),
        "x-upload-content-type": "video/mp4",
      },
      body: JSON.stringify({
        snippet: {
          title: job.title,
          description: job.description,
          tags: job.tags,
          categoryId: job.category_id,
        },
        status: {
          privacyStatus: job.privacy_status,
          selfDeclaredMadeForKids: job.made_for_kids,
        },
      }),
      signal: AbortSignal.timeout(20_000),
    },
  );
  if (response.status === 401 || response.status === 403)
    throw new TaskFailure(
      "youtube_reconnect_required",
      "YouTube rejected publishing access. Reconnect and grant upload permission.",
      false,
    );
  const location = response.headers.get("location");
  if (!response.ok || !location)
    throw new TaskFailure(
      "youtube_upload_start_failed",
      `YouTube could not start the upload (${response.status}).`,
      response.status >= 500 || response.status === 429,
    );
  await supabase
    .from("publishing_jobs")
    .update({
      status: "uploading",
      resumable_session_encrypted: encryptSecret(location, encryptionKey),
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", String(job.id));
  return location;
}

async function uploadFile(sessionUrl: string, file: string, size: number, token: string) {
  let start = 0;
  const status = await fetch(sessionUrl, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${token}`,
      "content-length": "0",
      "content-range": `bytes */${size}`,
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (status.ok) return z.object({ id: z.string() }).parse(await status.json()).id;
  if (status.status === 308) {
    const range = status.headers.get("range")?.match(/bytes=0-(\d+)/);
    start = range ? Number(range[1]) + 1 : 0;
  } else if (![404, 410].includes(status.status)) {
    throw new TaskFailure(
      "youtube_upload_status_failed",
      `YouTube upload status returned ${status.status}.`,
      status.status >= 500 || status.status === 429,
    );
  } else {
    throw new TaskFailure(
      "youtube_upload_session_expired",
      "The YouTube upload session expired. Retry publishing.",
      false,
    );
  }
  const end = size - 1;
  const response = await fetch(sessionUrl, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "video/mp4",
      "content-length": String(size - start),
      "content-range": `bytes ${start}-${end}/${size}`,
    },
    body: Readable.toWeb(createReadStream(file, { start })) as never,
    duplex: "half",
    signal: AbortSignal.timeout(6 * 60 * 60_000),
  } as RequestInit & { duplex: "half" });
  if (!response.ok)
    throw new TaskFailure(
      "youtube_upload_failed",
      `YouTube upload returned ${response.status}.`,
      response.status >= 500 || response.status === 429 || response.status === 308,
    );
  return z.object({ id: z.string() }).parse(await response.json()).id;
}

async function processingStatus(videoId: string, token: string) {
  const params = new URLSearchParams({ id: videoId, part: "processingDetails,status" });
  const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return { state: "processing" as const };
  const body = z
    .object({
      items: z.array(
        z.object({
          processingDetails: z
            .object({
              processingStatus: z.string(),
              processingFailureReason: z.string().optional(),
            })
            .optional(),
        }),
      ),
    })
    .parse(await response.json());
  const details = body.items[0]?.processingDetails;
  return details?.processingStatus === "succeeded"
    ? { state: "published" as const }
    : details?.processingStatus === "failed"
      ? { state: "failed" as const, reason: details.processingFailureReason ?? "processing_failed" }
      : { state: "processing" as const };
}

export async function publishYouTubeVideo(task: ClipTask): Promise<TaskResult> {
  return withTaskDirectory(task, async (directory) => {
    const publishingJobId = uuid.parse(task.input_json.publishingJobId);
    const config = requireGoogleConfig();
    const { data: job, error: jobError } = await supabase
      .from("publishing_jobs")
      .select("*")
      .eq("id", publishingJobId)
      .single();
    if (jobError) throw jobError;
    if (job.status === "cancelled")
      return { output: { cancelled: true }, message: "YouTube publishing was cancelled." };
    const [{ data: exportItem, error: exportError }, { data: channel, error: channelError }] =
      await Promise.all([
        supabase.from("exports").select("*").eq("id", job.export_id).single(),
        supabase.from("youtube_channels").select("*").eq("id", job.youtube_channel_id).single(),
      ]);
    if (exportError) throw exportError;
    if (channelError) throw channelError;
    if (!exportItem.storage_bucket || !exportItem.storage_path)
      throw new TaskFailure(
        "youtube_export_missing",
        "The completed export is unavailable.",
        false,
      );
    const { data: connection, error: connectionError } = await supabase
      .from("oauth_connections")
      .select("*")
      .eq("id", channel.connection_id)
      .single();
    if (connectionError) throw connectionError;
    if (
      connection.status !== "connected" ||
      !Array.isArray(connection.capabilities) ||
      !connection.capabilities.includes("video_publish")
    ) {
      await supabase
        .from("publishing_jobs")
        .update({ status: "reconnect_required" })
        .eq("id", job.id);
      return {
        output: { reconnectRequired: true },
        message: "Reconnect YouTube and grant publishing access.",
      };
    }
    const token = await accessToken(connection as Record<string, unknown>);
    let videoId = job.provider_video_id as string | null;
    if (!videoId) {
      const file = join(directory, basename(exportItem.storage_path));
      await downloadAsset(exportItem.storage_bucket, exportItem.storage_path, file);
      const size = (await stat(file)).size;
      let sessionUrl = job.resumable_session_encrypted
        ? decryptSecret(job.resumable_session_encrypted, config.encryptionKey)
        : null;
      if (!sessionUrl)
        sessionUrl = await initiateUpload(
          job as Record<string, unknown>,
          token,
          size,
          config.encryptionKey,
        );
      videoId = await uploadFile(sessionUrl, file, size, token);
      await supabase
        .from("publishing_jobs")
        .update({
          provider_video_id: videoId,
          provider_video_url: `https://www.youtube.com/watch?v=${videoId}`,
          resumable_session_encrypted: null,
          status: "processing",
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
    }
    let providerState = await processingStatus(videoId, token);
    for (let attempt = 0; providerState.state === "processing" && attempt < 23; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 5_000));
      providerState = await processingStatus(videoId, token);
    }
    if (providerState.state === "failed") {
      await supabase
        .from("publishing_jobs")
        .update({
          status: "failed",
          last_error_code: providerState.reason,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      return {
        output: { videoId, providerState: "failed" },
        message: "YouTube rejected the uploaded video's processing.",
      };
    }
    const finalStatus = providerState.state === "published" ? "published" : "processing";
    await supabase
      .from("publishing_jobs")
      .update({
        status: finalStatus,
        completed_at: finalStatus === "published" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    return {
      output: { videoId, providerState: finalStatus },
      message:
        finalStatus === "published"
          ? "Video published to YouTube."
          : "YouTube is processing the uploaded video.",
    };
  });
}
