import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { extname, join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { z } from "zod";
import { env } from "../config/env.js";
import { TaskFailure, type ConnectorTask, type ConnectorTaskResult } from "../domain/types.js";
import { probeMedia } from "../media/probe.js";
import { decryptSecret } from "../security/token-crypto.js";
import { scanLocalFile } from "../security/virus-scan.js";
import { supabase, uploadAsset } from "../storage/client.js";
import { heartbeatConnectorTask } from "../queue/repository.js";
import { sha256 } from "./context.js";

const importSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  user_id: z.string().uuid(),
  connector_id: z.enum(["google_drive", "dropbox", "onedrive"]),
  connector_connection_id: z.string().uuid(),
  remote_asset_id: z.string().min(1),
  status: z.string(),
  source_metadata_json: z.record(z.string(), z.unknown()),
  destination_asset_id: z.string().uuid().nullable().optional(),
});
const connectionSchema = z.object({ access_token_encrypted: z.string(), status: z.string() });

function connectorKey() {
  const key = env.CONNECTOR_TOKEN_ENCRYPTION_KEY ?? env.GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY;
  if (!key)
    throw new TaskFailure(
      "connector_key_missing",
      "Connector token encryption is not configured in the worker.",
      false,
    );
  return key;
}

function providerRequest(
  connector: z.infer<typeof importSchema>["connector_id"],
  assetId: string,
  token: string,
) {
  if (connector === "google_drive")
    return new Request(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(assetId)}?alt=media`,
      { headers: { authorization: `Bearer ${token}`, accept: "application/octet-stream" } },
    );
  if (connector === "dropbox")
    return new Request("https://content.dropboxapi.com/2/files/download", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "dropbox-api-arg": JSON.stringify({ path: assetId }),
      },
    });
  return new Request(
    `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(assetId)}/content`,
    { headers: { authorization: `Bearer ${token}` } },
  );
}

function safeExtension(name: string, mime: string | null) {
  const extension = extname(name).slice(1).toLowerCase();
  if (["mp4", "mov", "mkv", "webm", "m4v", "mp3", "wav", "m4a"].includes(extension))
    return extension;
  if (mime === "video/mp4") return "mp4";
  if (mime?.startsWith("audio/")) return "audio";
  return "bin";
}

async function assertImportActive(importId: string) {
  const { data, error } = await supabase
    .from("connector_imports")
    .select("status")
    .eq("id", importId)
    .single();
  if (error) throw error;
  if (data.status === "cancelled")
    throw new TaskFailure("cancelled", "The connector import was cancelled.", false);
}

export async function handleConnectorImport(
  task: ConnectorTask,
  signal?: AbortSignal,
): Promise<ConnectorTaskResult> {
  if (task.task_type !== "stream_remote_asset")
    throw new TaskFailure(
      "unsupported_connector_task",
      `Connector task ${task.task_type} is not implemented.`,
      false,
    );
  const { data: rawImport, error: importError } = await supabase
    .from("connector_imports")
    .select("*")
    .eq("id", task.connector_import_id)
    .single();
  if (importError) throw importError;
  const imported = importSchema.parse(rawImport);
  if (imported.status === "cancelled")
    throw new TaskFailure("cancelled", "The connector import was cancelled.", false);
  if (imported.destination_asset_id)
    return {
      output: { assetId: imported.destination_asset_id, idempotent: true },
      message: "Connector import was already complete.",
    };
  const { data: rawConnection, error: connectionError } = await supabase
    .from("oauth_connections")
    .select("access_token_encrypted,status")
    .eq("id", imported.connector_connection_id)
    .single();
  if (connectionError) throw connectionError;
  const connection = connectionSchema.parse(rawConnection);
  if (connection.status !== "connected")
    throw new TaskFailure(
      "connector_reconnect_required",
      "The source account must be reconnected.",
      false,
    );
  const token = decryptSecret(connection.access_token_encrypted, connectorKey());
  const metadata = z
    .object({
      name: z.string().default("Imported source"),
      mimeType: z.string().nullable().default(null),
      sizeBytes: z.number().nullable().default(null),
      durationSeconds: z.number().nullable().default(null),
    })
    .parse(imported.source_metadata_json);
  const directory = await mkdtemp(join(env.WORKER_TEMP_ROOT, `${task.id}-`));
  try {
    await supabase
      .from("connector_imports")
      .update({
        status: "transferring",
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", imported.id);
    const response = await fetch(
      providerRequest(imported.connector_id, imported.remote_asset_id, token),
      {
        redirect: "follow",
        signal: signal ?? AbortSignal.timeout(env.DIRECT_DOWNLOAD_READ_TIMEOUT_MS),
      },
    );
    if (!response.ok || !response.body)
      throw new TaskFailure(
        "provider_download_failed",
        `The provider returned ${response.status} for the authorised asset.`,
        response.status >= 500 || response.status === 429,
      );
    const declared = Number(response.headers.get("content-length") ?? metadata.sizeBytes ?? 0);
    if (declared > env.MAX_DIRECT_DOWNLOAD_BYTES)
      throw new TaskFailure(
        "file_too_large",
        "The remote asset exceeds the configured transfer limit.",
        false,
      );
    const responseType = response.headers.get("content-type")?.split(";")[0] ?? metadata.mimeType;
    if (
      responseType &&
      !/^(video|audio)\//.test(responseType) &&
      responseType !== "application/octet-stream"
    )
      throw new TaskFailure(
        "invalid_mime",
        "The provider asset is not an audio or video file.",
        false,
      );
    const target = join(directory, `source.${safeExtension(metadata.name, responseType)}`);
    let bytes = 0;
    let lastHeartbeat = 0;
    let cancelled = false;
    const meter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        if (cancelled)
          return callback(
            new TaskFailure("cancelled", "The connector import was cancelled.", false),
          );
        bytes += chunk.length;
        if (bytes > env.MAX_DIRECT_DOWNLOAD_BYTES)
          return callback(
            new TaskFailure(
              "file_too_large",
              "The streamed provider asset exceeded the transfer limit.",
              false,
            ),
          );
        if (Date.now() - lastHeartbeat > 5000) {
          lastHeartbeat = Date.now();
          void heartbeatConnectorTask(task.id, bytes, declared || undefined);
          void supabase
            .from("connector_imports")
            .update({
              bytes_transferred: bytes,
              bytes_total: declared || null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", imported.id);
          void supabase
            .from("connector_imports")
            .select("status")
            .eq("id", imported.id)
            .single()
            .then(({ data }) => {
              cancelled = data?.status === "cancelled";
            });
        }
        callback(null, chunk);
      },
    });
    await pipeline(
      Readable.fromWeb(response.body as never),
      meter,
      createWriteStream(target, { flags: "wx" }),
      { signal },
    );
    await assertImportActive(imported.id);
    await supabase
      .from("connector_imports")
      .update({
        status: "verifying",
        bytes_transferred: bytes,
        bytes_total: declared || bytes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", imported.id)
      .neq("status", "cancelled");
    const virusScan = await scanLocalFile(target);
    const info = await probeMedia(target);
    if (!info.hasAudio)
      throw new TaskFailure("missing_audio", "Speech clipping requires an audio stream.", false);
    const checksum = await sha256(target);
    await assertImportActive(imported.id);
    const extension = safeExtension(metadata.name, responseType);
    const storagePath = `${imported.workspace_id}/${imported.user_id}/${imported.id}/source/${randomUUID()}.${extension}`;
    await uploadAsset(
      "source-media",
      storagePath,
      target,
      responseType ?? "application/octet-stream",
    );
    const assetId = randomUUID();
    const { error: assetError } = await supabase.from("media_assets").insert({
      id: assetId,
      workspace_id: imported.workspace_id,
      user_id: imported.user_id,
      source_type: imported.connector_id,
      storage_bucket: "source-media",
      storage_path: storagePath,
      display_name: metadata.name,
      mime_type: responseType ?? "application/octet-stream",
      size_bytes: (await stat(target)).size,
      checksum_sha256: checksum,
      duration_seconds: info.durationSeconds,
      width: info.width,
      height: info.height,
      video_codec: info.videoCodec,
      audio_codec: info.audioCodec,
      has_audio: info.hasAudio,
      status: "ready",
      metadata_json: { ...info, connectorImportId: imported.id, virusScan },
    });
    if (assetError) throw assetError;
    const { error: updateError } = await supabase
      .from("connector_imports")
      .update({
        destination_asset_id: assetId,
        status: "ready",
        checksum,
        bytes_transferred: bytes,
        bytes_total: declared || bytes,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", imported.id)
      .neq("status", "cancelled")
      .is("destination_asset_id", null);
    if (updateError) throw updateError;
    return {
      output: { assetId, checksum, bytes, durationSeconds: info.durationSeconds },
      message: "Authorised provider asset imported and verified.",
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
