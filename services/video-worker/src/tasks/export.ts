import { randomUUID } from "node:crypto";
import { stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import type { ClipTask, TaskResult } from "../domain/types.js";
import { createAss, createSrt, createVtt } from "../media/captions.js";
import { renderClip } from "../media/ffmpeg.js";
import { editManifestSchema, renderManifestHash } from "../media/manifest.js";
import { safeFilename } from "../storage/filenames.js";
import { supabase, uploadAsset } from "../storage/client.js";
import { downloadJobSource, immutablePath, sha256, withTaskDirectory } from "./context.js";

const uuid = z.string().uuid();
const renderSettingsSchema = z.object({
  width: z.coerce.number().int().min(320).max(3840).default(1280),
  height: z.coerce.number().int().min(320).max(3840).default(720),
  fps: z.coerce.number().int().min(15).max(60).default(30),
  captionMode: z.enum(["burned_in", "separate", "both"]).default("both"),
});

export async function renderExport(task: ClipTask): Promise<TaskResult> {
  return withTaskDirectory(task, async (directory) => {
    const renderId = uuid.parse(task.input_json.renderJobId);
    const exportId = uuid.parse(task.input_json.exportId);
    const { data: render, error } = await supabase
      .from("render_jobs")
      .select("*")
      .eq("id", renderId)
      .single();
    if (error) throw error;
    const [{ data: clip, error: clipError }, { data: version, error: versionError }] =
      await Promise.all([
        supabase.from("clips").select("*").eq("id", render.clip_id).single(),
        supabase.from("clip_versions").select("*").eq("id", render.clip_version_id).single(),
      ]);
    if (clipError) throw clipError;
    if (versionError) throw versionError;

    const { job, target } = await downloadJobSource(task.clip_job_id, directory);
    const manifest = editManifestSchema.parse(version.edit_manifest_json);
    const duration = manifest.endSeconds - manifest.startSeconds;
    const settings = renderSettingsSchema.parse(render.settings_json);
    const base = safeFilename(manifest.title || clip.title);
    const ass = join(directory, `${base}.ass`);
    const srt = join(directory, `${base}.srt`);
    const vtt = join(directory, `${base}.vtt`);
    await Promise.all([
      writeFile(
        ass,
        createAss(manifest.captions.text, duration, {
          cues: manifest.captions.cues,
          height: settings.height,
          settings: manifest.captions,
          width: settings.width,
        }),
        "utf8",
      ),
      writeFile(srt, createSrt(manifest.captions.text, duration, manifest.captions.cues), "utf8"),
      writeFile(vtt, createVtt(manifest.captions.text, duration, manifest.captions.cues), "utf8"),
    ]);

    const output = join(directory, `${base}.mp4`);
    const sourceChecksum = await sha256(target);
    const immutableManifest = {
      sourceChecksum,
      clipVersionId: version.id,
      editManifest: manifest,
      watermark: { required: render.watermark_required },
      codec: {
        format: "mp4",
        video: "h264",
        audio: "aac",
        width: settings.width,
        height: settings.height,
        fps: settings.fps,
      },
      workerVersion: process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? "local",
    };
    const immutableManifestHash = renderManifestHash(immutableManifest);
    await renderClip({
      source: target,
      output,
      start: manifest.startSeconds,
      duration,
      width: settings.width,
      height: settings.height,
      watermark: render.watermark_required,
      captionsFile:
        settings.captionMode === "burned_in" || settings.captionMode === "both" ? ass : undefined,
      manifest,
    });

    const videoPath = immutablePath(job, "exports", "mp4");
    await uploadAsset("clip-exports", videoPath, output, "video/mp4");
    const captionRoot = `${job.workspace_id}/${job.user_id}/${job.id}/captions/${randomUUID()}`;
    const [srtPath, vttPath] = await Promise.all([
      uploadAsset("caption-assets", `${captionRoot}.srt`, srt, "application/x-subrip"),
      uploadAsset("caption-assets", `${captionRoot}.vtt`, vtt, "text/vtt"),
    ]);
    const assetId = randomUUID();
    const checksum = await sha256(output);
    const size = (await stat(output)).size;
    const { error: assetError } = await supabase.from("media_assets").insert({
      id: assetId,
      workspace_id: job.workspace_id,
      user_id: job.user_id,
      source_type: job.source_type,
      storage_bucket: "clip-exports",
      storage_path: videoPath,
      display_name: `${base}.mp4`,
      mime_type: "video/mp4",
      size_bytes: size,
      checksum_sha256: checksum,
      status: "ready",
      metadata_json: {
        renderManifest: immutableManifest,
        renderManifestHash: immutableManifestHash,
        srtPath,
        vttPath,
      },
    });
    if (assetError) throw assetError;

    const now = new Date().toISOString();
    const { error: renderError } = await supabase
      .from("render_jobs")
      .update({
        status: "complete",
        output_asset_id: assetId,
        completed_at: now,
        settings_json: {
          ...settings,
          renderManifest: immutableManifest,
          renderManifestHash: immutableManifestHash,
          srtPath,
          vttPath,
        },
      })
      .eq("id", render.id);
    if (renderError) throw renderError;
    const { error: exportError } = await supabase
      .from("exports")
      .update({
        status: "complete",
        storage_bucket: "clip-exports",
        storage_path: videoPath,
        size_bytes: size,
        checksum_sha256: checksum,
        completed_at: now,
      })
      .eq("id", exportId);
    if (exportError) throw exportError;
    return {
      output: {
        assetId,
        exportId,
        videoPath,
        srtPath,
        vttPath,
        renderManifestHash: immutableManifestHash,
        watermarked: render.watermark_required,
      },
      jobStatus: "ready",
      message: `Final ${settings.width}x${settings.height} export rendered${render.watermark_required ? " with Vidrial watermark" : " without watermark"}.`,
    };
  });
}
