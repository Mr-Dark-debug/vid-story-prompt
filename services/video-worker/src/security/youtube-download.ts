import { join } from "node:path";
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

const YTDLP_PATH = process.env.YTDLP_PATH ?? "yt-dlp";

export async function downloadYouTubeMedia(
  videoId: string,
  directory: string,
  signal?: AbortSignal,
): Promise<{ bytes: number; format: string; filename: string }> {
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
    throw new TaskFailure("invalid_video_id", "The YouTube video ID is malformed.", false);
  }

  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const output = join(directory, "yt-source.%(ext)s");

  const args = [
    "--no-playlist",
    "--no-overwrites",
    "--restrict-filenames",
    // Best video+audio merged, capped at 1080p to control size
    "-f", "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best",
    "--merge-output-format", "mp4",
    // Security: no cookies, no cache, no config
    "--no-cookies",
    "--no-cache-dir",
    "--ignore-config",
    // Size limit via max-filesize (yt-dlp will abort if exceeded)
    "--max-filesize", String(env.MAX_DIRECT_DOWNLOAD_BYTES),
    // Output template
    "-o", output,
    // Print the final filename to stdout for parsing
    "--print", "after_move:filepath",
    // No post-processing beyond merge
    "--no-post-overwrites",
    url,
  ];

  const timeoutMs = env.YTDLP_TIMEOUT_MS ?? 600_000; // 10 minutes default

  try {
    const result = await execa(YTDLP_PATH, args, {
      timeout: timeoutMs,
      signal,
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

    const fileStat = await stat(filepath);
    if (fileStat.size > env.MAX_DIRECT_DOWNLOAD_BYTES) {
      throw new TaskFailure(
        "file_too_large",
        "The downloaded YouTube video exceeds the configured maximum file size.",
        false,
      );
    }

    const ext = filepath.split(".").pop() ?? "mp4";

    return {
      bytes: fileStat.size,
      format: ext,
      filename: filepath,
    };
  } catch (error: unknown) {
    if (error instanceof TaskFailure) throw error;

    const message = error instanceof Error ? error.message : String(error);

    // Classify yt-dlp failures
    if (message.includes("Video unavailable") || message.includes("Private video")) {
      throw new TaskFailure("video_unavailable", "The YouTube video is private or unavailable.", false);
    }
    if (message.includes("Sign in") || message.includes("age-restricted")) {
      throw new TaskFailure("video_restricted", "The YouTube video requires sign-in or is age-restricted.", false);
    }
    if (message.includes("ETIMEDOUT") || message.includes("timed out")) {
      throw new TaskFailure("download_timeout", "The YouTube download timed out.", true);
    }
    if (message.includes("max-filesize")) {
      throw new TaskFailure("file_too_large", "The YouTube video exceeds the configured maximum file size.", false);
    }

    throw new TaskFailure(
      "ytdlp_error",
      `yt-dlp failed: ${message.slice(0, 200)}`,
      true,
    );
  }
}
