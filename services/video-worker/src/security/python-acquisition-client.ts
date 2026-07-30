import { relative, resolve } from "node:path";
import { stat } from "node:fs/promises";
import { z } from "zod";
import { env } from "../config/env.js";
import { TaskFailure } from "../domain/types.js";
import type { YouTubeDownloadStrategy, YouTubeSourceSection } from "./youtube-download.js";
import type { YouTubeProxySelection } from "./youtube-proxy.js";

const statusSchema = z.object({
  request_id: z.string(),
  state: z.enum([
    "accepted",
    "extracting",
    "downloading",
    "postprocessing",
    "completed",
    "failed",
    "cancelled",
  ]),
  progress_current: z.number().int().nonnegative().nullable().optional(),
  progress_total: z.number().int().positive().nullable().optional(),
  result: z
    .object({
      bytes: z.number().int().positive(),
      filename: z.string().min(1),
      format: z.enum(["mp4", "webm", "mkv"]),
      section_applied: z.boolean(),
    })
    .nullable()
    .optional(),
  error_code: z.string().nullable().optional(),
  error_message: z.string().nullable().optional(),
  retryable: z.boolean().nullable().optional(),
});

type Fetch = typeof fetch;

export type PythonAcquisitionInput = {
  requestId: string;
  jobId: string;
  taskId: string;
  videoId: string;
  directory: string;
  maximumDurationSeconds: number;
  maximumHeight: 720 | 1080 | 2160;
  outputFormat: "mp4";
  strategy: YouTubeDownloadStrategy;
  proxy: YouTubeProxySelection;
  section?: YouTubeSourceSection;
};

type PythonAcquisitionClientOptions = {
  baseUrl?: string;
  fetchImpl?: Fetch;
  pollMs?: number;
  timeoutMs?: number;
  token?: string;
};

function requestSignal(signal: AbortSignal | undefined, timeoutMs = 10_000) {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

function safeBaseUrl(value: string) {
  const url = new URL(value);
  if (!/^https?:$/.test(url.protocol) || url.username || url.password) {
    throw new TaskFailure(
      "provider_configuration_error",
      "The Python acquisition service URL is invalid.",
      false,
    );
  }
  return url.toString().replace(/\/$/, "");
}

async function readStatus(response: Response) {
  if (!response.ok) {
    throw new TaskFailure(
      "python_acquisition_unavailable",
      "The Python acquisition service is temporarily unavailable.",
      true,
    );
  }
  try {
    const body = await response.text();
    if (body.length > 32_768) throw new Error("response_too_large");
    return statusSchema.parse(JSON.parse(body));
  } catch {
    throw new TaskFailure(
      "python_acquisition_invalid_response",
      "The Python acquisition service returned an invalid response.",
      true,
    );
  }
}

function wait(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolveWait, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error("cancelled"));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason ?? new Error("cancelled"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolveWait();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

const failureMessages: Record<string, { message: string; retryable: boolean }> = {
  cancelled: { message: "The YouTube acquisition was cancelled.", retryable: false },
  file_too_large: {
    message: "The YouTube source exceeds the configured maximum file size.",
    retryable: false,
  },
  provider_auth_challenge: {
    message: "YouTube blocked this request from the server network.",
    retryable: true,
  },
  provider_configuration_error: {
    message: "The protected YouTube acquisition path is not configured correctly.",
    retryable: false,
  },
  provider_rate_limited: {
    message: "YouTube temporarily rate-limited the acquisition worker.",
    retryable: true,
  },
  provider_temporary_failure: {
    message: "YouTube could not be reached through this acquisition path.",
    retryable: true,
  },
  unsupported_video: {
    message: "The YouTube video is live or exceeds the reserved duration.",
    retryable: false,
  },
  video_age_restricted: {
    message: "This YouTube video is age-restricted and cannot be imported.",
    retryable: false,
  },
  video_drm_protected: {
    message: "This YouTube video is DRM-protected and cannot be imported.",
    retryable: false,
  },
  video_private: { message: "This YouTube video is private.", retryable: false },
  video_region_restricted: {
    message: "This YouTube video is not available in the worker region.",
    retryable: false,
  },
  video_unavailable: { message: "This YouTube video is unavailable.", retryable: false },
};

export async function downloadYouTubeWithPython(
  input: PythonAcquisitionInput,
  signal?: AbortSignal,
  options: PythonAcquisitionClientOptions = {},
): Promise<{
  bytes: number;
  filename: string;
  format: string;
  proxyTier: YouTubeProxySelection["tier"];
  sectionApplied: boolean;
}> {
  const baseUrl = safeBaseUrl(options.baseUrl ?? env.PYTHON_ACQUISITION_URL);
  const token = options.token ?? env.PYTHON_ACQUISITION_TOKEN;
  if (!token) {
    throw new TaskFailure(
      "provider_configuration_error",
      "The Python acquisition service token is not configured.",
      false,
    );
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  const endpoint = `${baseUrl}/v1/downloads`;
  const body = {
    request_id: input.requestId,
    job_id: input.jobId,
    task_id: input.taskId,
    video_id: input.videoId,
    output_directory: resolve(input.directory),
    maximum_duration_seconds: input.maximumDurationSeconds,
    maximum_height: input.maximumHeight,
    output_format: input.outputFormat,
    strategy: input.strategy,
    proxy_url: input.proxy.url ?? null,
    source_section: input.section
      ? {
          start_seconds: input.section.startSeconds,
          end_seconds: input.section.endSeconds,
        }
      : null,
  };
  const startedAt = Date.now();
  const timeoutMs = options.timeoutMs ?? env.YTDLP_TIMEOUT_MS;
  let submitted = false;
  let terminal = false;
  try {
    let status = await readStatus(
      await fetchImpl(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: requestSignal(signal),
      }),
    );
    submitted = true;
    while (!["completed", "failed", "cancelled"].includes(status.state)) {
      if (Date.now() - startedAt >= timeoutMs) {
        throw new TaskFailure(
          "provider_temporary_failure",
          "The Python acquisition service exceeded the download timeout.",
          true,
        );
      }
      await wait(options.pollMs ?? env.PYTHON_ACQUISITION_POLL_MS, signal);
      status = await readStatus(
        await fetchImpl(`${endpoint}/${encodeURIComponent(input.requestId)}`, {
          headers,
          signal: requestSignal(signal),
        }),
      );
    }
    if (status.state !== "completed" || !status.result) {
      terminal = true;
      const reportedCode = status.error_code ?? "";
      const knownCode = reportedCode in failureMessages ? reportedCode : "provider_temporary_failure";
      const failure = failureMessages[knownCode]!;
      throw new TaskFailure(
        status.state === "cancelled" ? "cancelled" : knownCode,
        status.state === "cancelled" ? failureMessages.cancelled.message : failure.message,
        status.state === "cancelled" ? false : failure.retryable,
        { proxyTier: input.proxy.tier },
      );
    }

    const directory = resolve(input.directory);
    const filename = resolve(status.result.filename);
    const child = relative(directory, filename);
    if (!child || child.startsWith("..") || resolve(directory, child) !== filename) {
      throw new TaskFailure(
        "invalid_output_path",
        "The Python acquisition service returned an artifact outside its task directory.",
        false,
      );
    }
    const file = await stat(filename);
    if (file.size !== status.result.bytes || file.size > env.MAX_DIRECT_DOWNLOAD_BYTES) {
      throw new TaskFailure(
        "invalid_media_size",
        "The Python acquisition artifact size did not pass worker validation.",
        false,
      );
    }
    return {
      bytes: file.size,
      filename,
      format: status.result.format,
      proxyTier: input.proxy.tier,
      sectionApplied: status.result.section_applied,
    };
  } catch (error) {
    if (submitted && !terminal) {
      await fetchImpl(`${endpoint}/${encodeURIComponent(input.requestId)}`, {
        method: "DELETE",
        headers,
        signal: AbortSignal.timeout(2_000),
      }).catch(() => undefined);
    }
    if (signal?.aborted) {
      throw new TaskFailure("cancelled", "The YouTube acquisition was cancelled.", false);
    }
    if (error instanceof TaskFailure) throw error;
    throw new TaskFailure(
      "python_acquisition_unavailable",
      "The Python acquisition service is temporarily unavailable.",
      true,
      { proxyTier: input.proxy.tier },
    );
  }
}
