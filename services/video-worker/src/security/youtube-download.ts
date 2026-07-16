import { extname, join, relative, resolve } from "node:path";
import { stat } from "node:fs/promises";
import { execa } from "execa";
import { env } from "../config/env.js";
import { TaskFailure } from "../domain/types.js";

/**
 * Downloads YouTube video media using yt-dlp with security controls.
 *
 * Constraints:
 * - Only HTTPS sources (yt-dlp default for YouTube)
 * - File size bounded by MAX_DIRECT_DOWNLOAD_BYTES
 * - Timeout bounded by YTDLP_TIMEOUT_MS
 * - No cookies, no login — public/unlisted videos only
 * - Output path is deterministic (caller controls destination)
 */

export function buildYouTubeDownloadArgs(
  videoId: string,
  directory: string,
  maximumDurationSeconds: number,
): string[] {
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
    throw new TaskFailure("invalid_video_id", "The YouTube video ID is malformed.", false);
  }
  if (!Number.isFinite(maximumDurationSeconds) || maximumDurationSeconds <= 0) {
    throw new TaskFailure("invalid_duration", "The reserved source duration is invalid.", false);
  }

  const durationBound = Math.ceil(maximumDurationSeconds * 1.05 + 5);
  const output = join(directory, "yt-source.%(ext)s");
  return [
    "--no-playlist",
    "--no-overwrites",
    "--restrict-filenames",
    "--no-progress",
    "--no-part",
    "-f",
    "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best",
    "--merge-output-format",
    "mp4",
    "--no-cookies",
    "--no-cache-dir",
    "--ignore-config",
    "--js-runtimes",
    "node",
    "--retries",
    "3",
    "--fragment-retries",
    "3",
    "--max-filesize",
    String(env.MAX_DIRECT_DOWNLOAD_BYTES),
    "--match-filters",
    `!is_live & duration <= ${durationBound}`,
    "-o",
    output,
    "--print",
    "after_move:filepath",
    "--no-post-overwrites",
    `https://www.youtube.com/watch?v=${videoId}`,
  ];
}

export async function downloadYouTubeMedia(
  videoId: string,
  directory: string,
  maximumDurationSeconds: number,
  signal?: AbortSignal,
): Promise<{ bytes: number; format: string; filename: string }> {
  const args = buildYouTubeDownloadArgs(videoId, directory, maximumDurationSeconds);

  try {
    const result = await execa(env.YTDLP_PATH, args, {
      timeout: env.YTDLP_TIMEOUT_MS,
      cancelSignal: signal,
      reject: true,
    });

    const stdout = String(result.stdout ?? "");
    const filepath = stdout.trim().split("\n").pop()?.trim();

    if (!filepath) {
      throw new TaskFailure(
        "ytdlp_no_output",
        "yt-dlp completed but did not report an output file.",
        true,
      );
    }

    const relativePath = relative(resolve(directory), resolve(filepath));
    if (relativePath.startsWith("..") || relativePath === "") {
      throw new TaskFailure(
        "invalid_output_path",
        "yt-dlp reported an output outside the isolated task directory.",
        false,
      );
    }

    const fileStat = await stat(filepath);
    if (fileStat.size > env.MAX_DIRECT_DOWNLOAD_BYTES) {
      throw new TaskFailure(
        "file_too_large",
        "The downloaded YouTube video exceeds the configured maximum file size.",
        false,
      );
    }

    const ext = extname(filepath).slice(1).toLowerCase();
    if (!/^[a-z0-9]{1,8}$/.test(ext)) {
      throw new TaskFailure(
        "invalid_media_format",
        "The downloaded media format is invalid.",
        false,
      );
    }

    return {
      bytes: fileStat.size,
      format: ext,
      filename: filepath,
    };
  } catch (error: unknown) {
    if (error instanceof TaskFailure) throw error;

    if (signal?.aborted) {
      throw new TaskFailure("cancelled", "The worker stopped YouTube acquisition.", true);
    }

    const message = error instanceof Error ? error.message.toLowerCase() : "";

    // Classify yt-dlp failures
    if (message.includes("video unavailable") || message.includes("private video")) {
      throw new TaskFailure(
        "video_unavailable",
        "The YouTube video is private or unavailable.",
        false,
      );
    }
    if (message.includes("sign in") || message.includes("age-restricted")) {
      throw new TaskFailure(
        "video_restricted",
        "The YouTube video requires sign-in or is age-restricted.",
        false,
      );
    }
    if (message.includes("etimedout") || message.includes("timed out")) {
      throw new TaskFailure("download_timeout", "The YouTube download timed out.", true);
    }
    if (message.includes("max-filesize")) {
      throw new TaskFailure(
        "file_too_large",
        "The YouTube video exceeds the configured maximum file size.",
        false,
      );
    }

    if (message.includes("does not pass filter") || message.includes("is live")) {
      throw new TaskFailure(
        "unsupported_video",
        "The YouTube video is live or exceeds the reserved duration.",
        false,
      );
    }

    throw new TaskFailure("ytdlp_error", "yt-dlp could not retrieve this YouTube video.", true);
  }
}
