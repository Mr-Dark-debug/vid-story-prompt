import { readFile } from "node:fs/promises";
import { dirname, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const run = promisify(execFile);
const prompts = JSON.parse(
  await readFile(resolve(repository, "content/motion/prompts.json"), "utf8"),
);
const manifest = JSON.parse(
  await readFile(resolve(repository, "content/motion/assets.json"), "utf8"),
);
const publish = process.argv.includes("--publish");
const checked = [];

function assetPath(url, extension) {
  if (
    typeof url !== "string" ||
    !/^\/motion-demos\/[a-z0-9-]+\.(mp4|jpg)$/.test(url) ||
    !url.endsWith(extension)
  )
    throw new Error("Manifest contains an invalid local asset path.");
  const path = resolve(repository, "public", url.slice(1));
  const scope = relative(resolve(repository, "public/motion-demos"), path);
  if (scope.startsWith("..") || isAbsolute(scope))
    throw new Error("Asset escapes the original demo directory.");
  return path;
}

// Validate the whole set before the first external write; publication never accepts a partial set.
for (const prompt of prompts) {
  const asset = manifest[prompt.slug];
  if (!asset)
    throw new Error(
      `Missing verified preview for ${prompt.slug}. Render and verify all original examples first.`,
    );
  const videoPath = assetPath(asset.videoUrl, ".mp4");
  const posterPath = assetPath(asset.posterUrl, ".jpg");
  const video = await readFile(videoPath);
  const poster = await readFile(posterPath);
  if (
    video.length === 0 ||
    video.length > 134217728 ||
    poster.length === 0 ||
    poster.length > 10485760
  )
    throw new Error(`Invalid asset size: ${prompt.slug}`);
  const { stdout } = await run(
    process.env.FFPROBE_PATH ?? "ffprobe",
    ["-v", "error", "-show_streams", "-show_format", "-of", "json", videoPath],
    { timeout: 15000, maxBuffer: 1048576 },
  );
  const probe = JSON.parse(stdout);
  const stream = probe.streams?.find((s) => s.codec_type === "video");
  const duration = Number(probe.format?.duration);
  if (
    !stream ||
    stream.codec_name !== "h264" ||
    stream.pix_fmt !== "yuv420p" ||
    stream.width !== asset.width ||
    stream.height !== asset.height ||
    !Number.isFinite(duration) ||
    Math.abs(duration - prompt.durationSeconds) > 0.15
  )
    throw new Error(`Media verification mismatch: ${prompt.slug}`);
  checked.push({ prompt, video, poster });
}

if (!publish) {
  process.stdout.write(
    `Validated ${checked.length} original MP4/poster pairs. No external changes. Use --publish only for the intended deployed database.\n`,
  );
} else {
  const url = process.env.SUPABASE_URL;
  const credential = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !credential)
    throw new Error(
      "Publication needs the intended Supabase URL and server-only service credential.",
    );
  const client = createClient(url, credential, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  for (const { prompt, video, poster } of checked) {
    const existing = await client
      .from("motion_prompts")
      .select("id,prompt,status,source")
      .eq("slug", prompt.slug)
      .maybeSingle();
    if (existing.error) throw new Error(`Could not check original row: ${prompt.slug}`);
    if (
      existing.data &&
      (existing.data.source !== "official" || existing.data.prompt !== prompt.prompt)
    )
      throw new Error(`Existing slug has different provenance or content: ${prompt.slug}`);
    if (existing.data?.status === "approved") {
      process.stdout.write(
        `Already approved: ${prompt.slug}; existing counters and immutable assets preserved.\n`,
      );
      continue;
    }
    if (existing.data?.status === "rejected")
      throw new Error(`Rejected original requires moderation review: ${prompt.slug}`);
    const id = existing.data?.id ?? randomUUID();
    if (!existing.data) {
      const result = await client.from("motion_prompts").insert({
        id,
        slug: prompt.slug,
        title: prompt.title,
        prompt: prompt.prompt,
        category: prompt.category,
        tags: prompt.tags,
        aspect: prompt.aspect,
        duration_seconds: prompt.durationSeconds,
        recommended_model: null,
        source: "official",
        author_display_name: "Vidrial Editorial Team",
        license: "vidrial_original",
        status: "pending",
        view_count: 0,
        like_count: 0,
        copy_count: 0,
        use_count: 0,
        created_at: "2026-10-03T00:00:00Z",
      });
      if (result.error) throw new Error(`Could not insert original row: ${prompt.slug}`);
    }
    const previewPath = `approved/${id}/${randomUUID()}.mp4`;
    const posterPath = `approved/${id}/${randomUUID()}.jpg`;
    const storage = client.storage.from("motion-gallery");
    const uploadedVideo = await storage.upload(previewPath, video, {
      contentType: "video/mp4",
      upsert: false,
      cacheControl: "31536000",
    });
    if (uploadedVideo.error) throw new Error(`Video upload failed: ${prompt.slug}`);
    const uploadedPoster = await storage.upload(posterPath, poster, {
      contentType: "image/jpeg",
      upsert: false,
      cacheControl: "31536000",
    });
    if (uploadedPoster.error) throw new Error(`Poster upload failed: ${prompt.slug}`);
    const approved = await client.rpc("approve_motion_prompt", {
      p_prompt_id: id,
      p_preview_path: previewPath,
      p_poster_path: posterPath,
    });
    if (approved.error)
      throw new Error(
        `Approval failed: ${prompt.slug}; assets remain unlisted until approval succeeds.`,
      );
    process.stdout.write(`Approved original: ${prompt.slug}\n`);
  }
}
