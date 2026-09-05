import { createReadStream } from "node:fs";
import { Upload } from "tus-js-client";
import { TaskFailure } from "../domain/types.js";

export function storageUploadEndpoint(projectUrl: string) {
  const url = new URL(projectUrl);
  if (/^[a-z0-9]+\.supabase\.co$/.test(url.hostname)) {
    url.hostname = url.hostname.replace(".supabase.co", ".storage.supabase.co");
  }
  url.pathname = "/storage/v1/upload/resumable";
  return url.toString();
}

export async function uploadResumable(input: {
  projectUrl: string;
  key: string;
  bucket: string;
  path: string;
  file: string;
  size: number;
  contentType: string;
  signal?: AbortSignal;
}) {
  input.signal?.throwIfAborted();
  const signal = input.signal
    ? AbortSignal.any([input.signal, AbortSignal.timeout(10 * 60_000)])
    : AbortSignal.timeout(10 * 60_000);
  const stream = createReadStream(input.file);
  try {
    await new Promise<void>((resolve, reject) => {
      const finish = (error?: unknown) => {
        signal.removeEventListener("abort", cancel);
        if (error) reject(error);
        else resolve();
      };
      const upload = new Upload(stream, {
        endpoint: storageUploadEndpoint(input.projectUrl),
        uploadSize: input.size,
        chunkSize: 6 * 1024 * 1024,
        retryDelays: [0, 1_000, 3_000, 5_000, 10_000],
        storeFingerprintForResuming: false,
        headers: { authorization: `Bearer ${input.key}`, apikey: input.key, "x-upsert": "false" },
        metadata: {
          bucketName: input.bucket,
          objectName: input.path,
          contentType: input.contentType,
          cacheControl: "3600",
        },
        onShouldRetry: (error) => {
          const status =
            "originalResponse" in error ? (error.originalResponse?.getStatus() ?? 0) : 0;
          return (
            !signal.aborted && (status === 0 || status === 408 || status === 429 || status >= 500)
          );
        },
        onError: (error) => {
          const status =
            "originalResponse" in error ? (error.originalResponse?.getStatus() ?? 0) : 0;
          let providerCode: string | undefined;
          if ("originalResponse" in error) {
            try {
              const body = JSON.parse(error.originalResponse?.getBody() ?? "{}");
              const candidate = body.code ?? body.error;
              if (typeof candidate === "string" && /^[a-zA-Z_ -]{1,80}$/.test(candidate))
                providerCode = candidate;
            } catch {
              /* Provider response bodies must not be logged. */
            }
          }
          finish(
            new TaskFailure(
              status === 413 ? "storage_limit_exceeded" : "storage_upload_failed",
              status === 413
                ? "This media exceeds the storage service's file limit."
                : "Private media could not be saved to storage.",
              status === 0 || status === 408 || status === 429 || status >= 500,
              { status, providerCode },
            ),
          );
        },
        onSuccess: () => finish(),
      });
      function cancel() {
        void upload.abort().then(
          () => finish(signal.reason ?? new Error("Upload cancelled")),
          () => finish(signal.reason ?? new Error("Upload cancelled")),
        );
      }
      signal.addEventListener("abort", cancel, { once: true });
      upload.start();
    });
  } finally {
    stream.destroy();
  }
}
