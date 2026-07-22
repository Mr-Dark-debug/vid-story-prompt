import { join } from "node:path";
import { stat } from "node:fs/promises";
import { execa } from "execa";
import { env } from "../config/env.js";
import { TaskFailure } from "../domain/types.js";
import { downloadDirectMedia } from "./direct-download.js";
import type { YouTubeSourceSection } from "./youtube-download.js";

type CobaltDownloadInput = {
  apiKey?: string;
  apiUrl: string;
  directory: string;
  maximumDurationSeconds: number;
  section?: YouTubeSourceSection;
  signal?: AbortSignal;
  timeoutMs: number;
  videoId: string;
};

type CobaltDependencies = {
  cooldownMs?: number;
  download?: typeof downloadDirectMedia;
  failureThreshold?: number;
  now?: () => number;
  request?: typeof fetch;
  runFfmpeg?: (args: string[], options: Record<string, unknown>) => Promise<unknown>;
  statFile?: typeof stat;
};

type CobaltResponse = {
  status?: unknown;
  url?: unknown;
  filename?: unknown;
  error?: { code?: unknown };
};

function apiEndpoint(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TaskFailure("cobalt_configuration_error", "The Cobalt API URL is invalid.", false);
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new TaskFailure(
      "cobalt_configuration_error",
      "The Cobalt API URL uses an unsupported configuration.",
      false,
    );
  }
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url.toString();
}

function returnedMediaUrl(value: unknown) {
  if (typeof value !== "string") {
    throw new TaskFailure("cobalt_invalid_response", "Cobalt did not return a media URL.", true);
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TaskFailure(
      "cobalt_invalid_media_url",
      "Cobalt returned an invalid media URL.",
      true,
    );
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new TaskFailure(
      "cobalt_invalid_media_url",
      "Cobalt returned an unsupported media URL.",
      true,
    );
  }
  return url.toString();
}

function validateSection(section: YouTubeSourceSection | undefined, maximum: number) {
  if (!section) return;
  if (
    !Number.isFinite(section.startSeconds) ||
    !Number.isFinite(section.endSeconds) ||
    section.startSeconds < 0 ||
    section.endSeconds <= section.startSeconds ||
    section.endSeconds > maximum
  ) {
    throw new TaskFailure(
      "invalid_source_section",
      "The requested source section is outside the reserved duration.",
      false,
    );
  }
}

export class CobaltClient {
  private readonly request: typeof fetch;
  private readonly downloadMedia: typeof downloadDirectMedia;
  private readonly runFfmpeg: NonNullable<CobaltDependencies["runFfmpeg"]>;
  private readonly statFile: typeof stat;
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly now: () => number;
  private consecutiveFailures = 0;
  private openUntil = 0;

  constructor(dependencies: CobaltDependencies = {}) {
    this.request = dependencies.request ?? fetch;
    this.downloadMedia = dependencies.download ?? downloadDirectMedia;
    this.runFfmpeg =
      dependencies.runFfmpeg ??
      ((args, options) => execa(env.FFMPEG_PATH, args, options).then(() => undefined));
    this.statFile = dependencies.statFile ?? stat;
    this.failureThreshold = Math.max(1, dependencies.failureThreshold ?? 3);
    this.cooldownMs = Math.max(1000, dependencies.cooldownMs ?? 60_000);
    this.now = dependencies.now ?? Date.now;
  }

  async download(input: CobaltDownloadInput): Promise<{
    bytes: number;
    filename: string;
    format: "mp4";
    proxyTier: "cobalt";
    sectionApplied: boolean;
  }> {
    if (!/^[A-Za-z0-9_-]{11}$/.test(input.videoId)) {
      throw new TaskFailure("invalid_video_id", "The YouTube video ID is malformed.", false);
    }
    validateSection(input.section, input.maximumDurationSeconds);
    if (this.openUntil > this.now()) {
      throw new TaskFailure(
        "cobalt_circuit_open",
        "The optional Cobalt source adapter is temporarily unavailable.",
        true,
      );
    }

    const rawTarget = join(input.directory, "cobalt-source-full.mp4");
    const sectionTarget = join(input.directory, "cobalt-source-section.mp4");
    try {
      const timeout = AbortSignal.timeout(input.timeoutMs);
      const signal = input.signal ? AbortSignal.any([input.signal, timeout]) : timeout;
      const response = await this.request(apiEndpoint(input.apiUrl), {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "user-agent": "Vidrial-Video-Worker/1.0",
          ...(input.apiKey ? { authorization: `Api-Key ${input.apiKey}` } : {}),
        },
        body: JSON.stringify({
          url: `https://www.youtube.com/watch?v=${input.videoId}`,
          videoQuality: "1080",
          downloadMode: "auto",
          youtubeVideoCodec: "h264",
          youtubeVideoContainer: "mp4",
          filenameStyle: "basic",
          disableMetadata: true,
        }),
        signal,
      });
      if (!response.ok) {
        throw new TaskFailure(
          "cobalt_unavailable",
          `The optional Cobalt source adapter returned HTTP ${response.status}.`,
          response.status >= 500 || response.status === 429,
        );
      }
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.toLowerCase().includes("application/json")) {
        throw new TaskFailure(
          "cobalt_invalid_response",
          "Cobalt returned an unexpected response type.",
          true,
        );
      }
      const text = await response.text();
      if (text.length > 64 * 1024) {
        throw new TaskFailure(
          "cobalt_invalid_response",
          "Cobalt returned an oversized response.",
          true,
        );
      }
      const payload = JSON.parse(text) as CobaltResponse;
      if (payload.status !== "tunnel" && payload.status !== "redirect") {
        const providerCode =
          typeof payload.error?.code === "string" ? payload.error.code.slice(0, 80) : "unsupported";
        throw new TaskFailure(
          "cobalt_provider_rejected",
          `The optional Cobalt source adapter could not provide this video (${providerCode}).`,
          payload.status === "error",
        );
      }

      const mediaUrl = returnedMediaUrl(payload.url);
      const downloaded = await this.downloadMedia(mediaUrl, rawTarget);
      let filename = rawTarget;
      let bytes = downloaded.bytes;
      if (input.section) {
        const duration = input.section.endSeconds - input.section.startSeconds;
        await this.runFfmpeg(
          [
            "-hide_banner",
            "-nostdin",
            "-y",
            "-ss",
            String(input.section.startSeconds),
            "-i",
            rawTarget,
            "-t",
            String(duration),
            "-c",
            "copy",
            sectionTarget,
          ],
          { cancelSignal: input.signal, timeout: env.YTDLP_TIMEOUT_MS },
        );
        filename = sectionTarget;
        bytes = (await this.statFile(sectionTarget)).size;
      }
      this.consecutiveFailures = 0;
      this.openUntil = 0;
      return {
        bytes,
        filename,
        format: "mp4",
        proxyTier: "cobalt",
        sectionApplied: Boolean(input.section),
      };
    } catch (error) {
      if (error instanceof TaskFailure && !error.retryable) throw error;
      this.consecutiveFailures += 1;
      if (this.consecutiveFailures >= this.failureThreshold) {
        this.openUntil = this.now() + this.cooldownMs;
      }
      if (error instanceof TaskFailure) throw error;
      if (input.signal?.aborted) {
        throw new TaskFailure("cancelled", "Cobalt acquisition was cancelled.", false);
      }
      throw new TaskFailure(
        "cobalt_unavailable",
        "The optional Cobalt source adapter could not be reached.",
        true,
      );
    }
  }
}

export const cobaltClient = new CobaltClient();
