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
  strategy: "standard" | "web-safari" | "mweb-pot" = "standard",
  potProviderUrl?: string,
): string[] {
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
    throw new TaskFailure("invalid_video_id", "The YouTube video ID is malformed.", false);
  }
  if (!Number.isFinite(maximumDurationSeconds) || maximumDurationSeconds <= 0) {
    throw new TaskFailure("invalid_duration", "The reserved source duration is invalid.", false);
  }

  const durationBound = Math.ceil(maximumDurationSeconds * 1.05 + 5);
  const output = join(directory, "yt-source.%(ext)s");
  const args = [
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
  ];

  if (strategy === "web-safari") {
    args.push("--extractor-args", "youtube:player_client=web_safari");
  }
  if (strategy === "mweb-pot") {
    if (!potProviderUrl) {
      throw new TaskFailure(
        "provider_configuration_error",
        "The YouTube proof-of-origin provider is not configured.",
        false,
      );
    }
    const provider = new URL(potProviderUrl);
    if (!/^https?:$/.test(provider.protocol) || provider.username || provider.password) {
      throw new TaskFailure(
        "provider_configuration_error",
        "The YouTube proof-of-origin provider URL is invalid.",
        false,
      );
    }
    args.push(
      "--extractor-args",
      "youtube:player_client=mweb",
      "--extractor-args",
      `youtubepot-bgutilhttp:base_url=${provider.toString().replace(/\/$/, "")}`,
    );
  }

  args.push(`https://www.youtube.com/watch?v=${videoId}`);
  return args;
}

export function classifyYouTubeDownloadFailure(input: string) {
  const message = input.toLowerCase();
  if (message.includes("private video") || message.includes("video is private")) {
    return new TaskFailure("video_private", "This YouTube video is private.", false);
  }
  if (message.includes("age-restricted") || message.includes("age restricted")) {
    return new TaskFailure(
      "video_age_restricted",
      "This YouTube video is age-restricted and cannot be imported.",
      false,
    );
  }
  if (
    message.includes("sign in to confirm") ||
    message.includes("not a bot") ||
    message.includes("proof of origin") ||
    message.includes("po token")
  ) {
    return new TaskFailure(
      "provider_auth_challenge",
      "YouTube temporarily challenged the video worker. Vidrial will retry.",
      true,
    );
  }
  if (message.includes("http error 429") || message.includes("too many requests")) {
    return new TaskFailure(
      "provider_rate_limited",
      "YouTube temporarily rate-limited the video worker. Vidrial will retry.",
      true,
    );
  }
  if (
    message.includes("etimedout") ||
    message.includes("timed out") ||
    /http error 5\d\d/.test(message)
  ) {
    return new TaskFailure(
      "provider_temporary_failure",
      "YouTube was temporarily unavailable. Vidrial will retry.",
      true,
    );
  }
  if (message.includes("video unavailable") || message.includes("has been removed")) {
    return new TaskFailure(
      "video_unavailable",
      "This YouTube video is unavailable.",
      false,
    );
  }
  return new TaskFailure(
    "provider_temporary_failure",
    "YouTube could not be reached. Vidrial will retry.",
    true,
  );
}

function failureText(error: unknown) {
  if (!(error instanceof Error)) return "";
  const details = error as Error & { stderr?: unknown; shortMessage?: unknown };
  return [details.message, details.shortMessage, details.stderr]
    .filter((value): value is string => typeof value === "string")
    .join("\n");
}

export async function downloadYouTubeMedia(
  videoId: string,
  directory: string,
  maximumDurationSeconds: number,
  signal?: AbortSignal,
  strategy: "standard" | "web-safari" | "mweb-pot" = "standard",
): Promise<{ bytes: number; format: string; filename: string }> {
  const args = buildYouTubeDownloadArgs(
    videoId,
    directory,
    maximumDurationSeconds,
    strategy,
    env.YTDLP_POT_PROVIDER_URL,
  );

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

    const message = failureText(error).toLowerCase();

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

    throw classifyYouTubeDownloadFailure(message);
  }
}
