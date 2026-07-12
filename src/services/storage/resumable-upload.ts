import * as tus from "tus-js-client";
import { getPublicEnv } from "@/config/env";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type UploadController = { abort: () => Promise<void>; retry: () => void };

export async function startResumableUpload(input: {
  file: File;
  bucket: string;
  objectPath: string;
  onProgress: (uploaded: number, total: number) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
}): Promise<UploadController> {
  const publicEnv = getPublicEnv();
  const { data } = await getSupabaseBrowserClient().auth.getSession();
  if (!data.session) throw new Error("Your session expired. Log in and resume the upload.");
  const upload = new tus.Upload(input.file, {
    endpoint: `${publicEnv.VITE_SUPABASE_URL}/storage/v1/upload/resumable`,
    headers: { authorization: `Bearer ${data.session.access_token}`, "x-upsert": "false" },
    metadata: {
      bucketName: input.bucket,
      objectName: input.objectPath,
      contentType: input.file.type || "application/octet-stream",
      cacheControl: "3600",
    },
    chunkSize: 6 * 1024 * 1024,
    retryDelays: [0, 1_000, 3_000, 5_000, 10_000],
    removeFingerprintOnSuccess: true,
    onProgress: input.onProgress,
    onSuccess: input.onComplete,
    onError: input.onError,
  });
  const previous = await upload.findPreviousUploads();
  if (previous[0]) upload.resumeFromPreviousUpload(previous[0]);
  upload.start();
  return { abort: () => upload.abort(false), retry: () => upload.start() };
}
