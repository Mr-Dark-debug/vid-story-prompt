import { CirclePause, FileVideo, RotateCcw, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { userFacingError } from "@/lib/user-facing-error";
import { completeSourceUpload, prepareSourceUpload } from "@/services/storage/server";
import { startResumableUpload, type UploadController } from "@/services/storage/resumable-upload";

export type UploadedSource = { assetId: string; filename: string; durationSeconds: number };

export function SourceUpload({
  onUploaded,
  projectId,
}: {
  onUploaded: (source: UploadedSource) => void;
  projectId?: string;
}) {
  const controller = useRef<UploadController | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [state, setState] = useState<
    "empty" | "ready" | "uploading" | "paused" | "complete" | "failed"
  >("empty");
  const [error, setError] = useState<string | null>(null);

  const choose = (next: File | undefined) => {
    if (!next) return;
    if (next.size > 10 * 1024 ** 3) {
      setError("This video is larger than the 10 GB upload limit.");
      return;
    }
    setFile(next);
    setState("ready");
    setError(null);
    setProgress(0);
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(next);
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      setDuration(Number.isFinite(video.duration) ? Math.ceil(video.duration) : 0);
      URL.revokeObjectURL(objectUrl);
    };
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setError(
        "The duration could not be read in this browser. The video will be validated after upload.",
      );
    };
    video.src = objectUrl;
  };

  const upload = async () => {
    if (!file) return;
    try {
      setState("uploading");
      setError(null);
      const prepared = await prepareSourceUpload({
        data: {
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          sourceType: "local_upload",
          projectId,
        },
      });
      controller.current = await startResumableUpload({
        file,
        bucket: prepared.bucket,
        objectPath: prepared.objectPath,
        onProgress: (uploaded, total) => setProgress(total ? uploaded / total : 0),
        onError: (cause) => {
          setError(userFacingError(cause, "The upload was interrupted. Resume it to continue."));
          setState("failed");
        },
        onComplete: async () => {
          try {
            await completeSourceUpload({
              data: { assetId: prepared.assetId, durationSeconds: duration },
            });
            setProgress(1);
            setState("complete");
            onUploaded({
              assetId: prepared.assetId,
              filename: file.name,
              durationSeconds: duration,
            });
          } catch (cause) {
            setError(
              userFacingError(cause, "The upload finished, but could not be finalised. Try again."),
            );
            setState("failed");
          }
        },
      });
    } catch (cause) {
      setError(userFacingError(cause, "The upload could not be started. Try again."));
      setState("failed");
    }
  };

  const pause = async () => {
    await controller.current?.abort();
    setState("paused");
  };

  const reset = () => {
    setFile(null);
    setDuration(0);
    setProgress(0);
    setError(null);
    setState("empty");
    controller.current = null;
  };

  const percent = Math.round(progress * 100);
  return (
    <div className="rounded-2xl border border-dashed border-line-strong bg-surface-raised p-5">
      {!file ? (
        <label className="flex min-h-44 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl py-7 text-center outline-none focus-within:ring-2 focus-within:ring-ember">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ember-soft text-ember-ink">
            <Upload className="h-5 w-5" />
          </span>
          <span className="text-sm font-medium text-ink">Choose a video file</span>
          <span className="text-xs text-ink-mute">MP4, MOV, MKV, WebM or M4V · up to 10 GB</span>
          <input
            className="sr-only"
            type="file"
            accept="video/mp4,video/quicktime,video/x-matroska,video/webm,video/x-m4v,.mp4,.mov,.mkv,.webm,.m4v"
            onChange={(event) => choose(event.target.files?.[0])}
          />
        </label>
      ) : (
        <div>
          <div className="flex items-center gap-3">
            <FileVideo className="h-5 w-5 text-ember" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-ink">{file.name}</div>
              <div className="text-xs text-ink-mute">
                {(file.size / 1024 ** 2).toFixed(1)} MB
                {duration ? ` · ${Math.ceil(duration / 60)} source minutes` : ""}
              </div>
            </div>
            {state !== "uploading" && state !== "complete" ? (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={reset}
                aria-label="Remove selected file"
              >
                <X />
              </Button>
            ) : null}
          </div>
          {state !== "ready" ? (
            <div className="mt-4">
              <div
                role="progressbar"
                aria-label="Upload progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                className="h-2 overflow-hidden rounded-full bg-surface-sunken"
              >
                <div
                  className="h-full bg-ember transition-[width] motion-reduce:transition-none"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between gap-3 text-xs text-ink-mute">
                <span>
                  {state === "complete"
                    ? "Upload complete · validation queued"
                    : state === "paused"
                      ? "Upload paused"
                      : state === "failed"
                        ? "Upload interrupted"
                        : "Uploading video"}
                </span>
                <span className="tabular-nums">{percent}%</span>
              </div>
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {state === "ready" ? (
              <Button type="button" onClick={() => void upload()}>
                Start resumable upload
              </Button>
            ) : null}
            {state === "uploading" ? (
              <Button type="button" variant="outline" onClick={() => void pause()}>
                <CirclePause />
                Pause
              </Button>
            ) : null}
            {state === "paused" || state === "failed" ? (
              <Button
                type="button"
                onClick={() => {
                  controller.current?.retry();
                  setState("uploading");
                  setError(null);
                }}
              >
                <RotateCcw />
                Resume
              </Button>
            ) : null}
            {state === "complete" ? (
              <Button type="button" variant="outline" onClick={reset}>
                Upload another
              </Button>
            ) : null}
          </div>
        </div>
      )}
      {error ? (
        <p role="alert" className="mt-3 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
