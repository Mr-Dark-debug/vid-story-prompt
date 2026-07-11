import { createWriteStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { ZipArchive } from "archiver";
import { z } from "zod";
import type { ClipTask, TaskResult } from "../domain/types.js";
import { dedupeFilename, safeFilename } from "../storage/filenames.js";
import { downloadAsset, supabase, uploadAsset } from "../storage/client.js";
import { getJob, immutablePath, sha256, withTaskDirectory } from "./context.js";

export async function renderBatchExport(task: ClipTask): Promise<TaskResult> {
  return withTaskDirectory(task, async (directory) => {
    const job = await getJob(task.clip_job_id);
    const clipIds = z.array(z.string().uuid()).min(1).max(50).parse(task.input_json.clipIds);
    const exportId = z.string().uuid().parse(task.input_json.exportId);
    const root = safeFilename(job.source_title ?? "source-clips");
    const used = new Set<string>();
    const manifest: { clipId: string; title: string; video: string }[] = [];
    const zipPath = join(directory, "clips.zip");
    const output = createWriteStream(zipPath, { flags: "wx" });
    const archive = new ZipArchive({ zlib: { level: 6 } });
    const finished = new Promise<void>((resolve, reject) => {
      output.on("close", resolve);
      archive.on("error", reject);
    });
    archive.pipe(output);
    for (let index = 0; index < clipIds.length; index++) {
      const clipId = clipIds[index];
      const { data: clip, error: clipError } = await supabase
        .from("clips")
        .select("title")
        .eq("id", clipId)
        .single();
      if (clipError) throw clipError;
      const { data: item, error } = await supabase
        .from("exports")
        .select("storage_bucket,storage_path")
        .eq("clip_id", clipId)
        .eq("status", "complete")
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!item?.storage_bucket || !item.storage_path) {
        throw new Error(`Clip ${clipId} needs a completed individual export before ZIP creation.`);
      }
      const folder = dedupeFilename(
        `${String(index + 1).padStart(2, "0")}-${safeFilename(clip.title)}`,
        used,
      );
      const video = join(directory, `${folder}.mp4`);
      await downloadAsset(item.storage_bucket, item.storage_path, video);
      archive.file(video, { name: `${root}/${folder}/clip.mp4` });
      archive.append(
        JSON.stringify({ clipId, title: clip.title, exportedAt: new Date().toISOString() }, null, 2),
        { name: `${root}/${folder}/metadata.json` },
      );
      manifest.push({ clipId, title: clip.title, video: `${folder}/clip.mp4` });
    }
    archive.append(
      JSON.stringify({ sourceTitle: job.source_title, jobId: job.id, clips: manifest }, null, 2),
      { name: `${root}/manifest.json` },
    );
    await archive.finalize();
    await finished;
    const path = immutablePath(job, "batch-exports", "zip");
    await uploadAsset("clip-exports", path, zipPath, "application/zip");
    const size = (await stat(zipPath)).size;
    const checksum = await sha256(zipPath);
    const now = new Date().toISOString();
    await supabase
      .from("exports")
      .update({ status: "complete", storage_bucket: "clip-exports", storage_path: path, size_bytes: size, checksum_sha256: checksum, completed_at: now })
      .eq("id", exportId);
    await supabase
      .from("render_jobs")
      .update({ status: "complete", completed_at: now })
      .eq("id", task.input_json.renderJobId);
    return {
      output: { exportId, path, size, checksum },
      jobStatus: "ready",
      message: `ZIP export created for ${clipIds.length} clips.`,
    };
  });
}
