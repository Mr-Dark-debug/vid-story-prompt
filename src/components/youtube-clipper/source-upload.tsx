import { useRef, useState } from "react";
import { CirclePause, FileVideo, RotateCcw, Upload, X } from "lucide-react";
import { completeSourceUpload, prepareSourceUpload } from "@/services/storage/server";
import { startResumableUpload, type UploadController } from "@/services/storage/resumable-upload";

export type UploadedSource = { assetId: string; filename: string; durationSeconds: number };

export function SourceUpload({ onUploaded }: { onUploaded: (source: UploadedSource) => void }) {
  const controller = useRef<UploadController | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [state, setState] = useState<"empty" | "ready" | "uploading" | "paused" | "complete" | "failed">("empty");
  const [error, setError] = useState<string | null>(null);

  const choose = (next: File | undefined) => {
    if (!next) return;
    if (next.size > 10 * 1024 ** 3) { setError("This file exceeds the 10 GB upload boundary."); return; }
    setFile(next); setState("ready"); setError(null); setProgress(0);
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(next);
    video.preload = "metadata";
    video.onloadedmetadata = () => { setDuration(Math.ceil(video.duration)); URL.revokeObjectURL(objectUrl); };
    video.onerror = () => { URL.revokeObjectURL(objectUrl); setError("The browser could not read the duration. The worker will validate the actual file."); };
    video.src = objectUrl;
  };
  const upload = async () => {
    if (!file) return;
    try {
      setState("uploading"); setError(null);
      const prepared = await prepareSourceUpload({ data: { filename: file.name, mimeType: file.type, sizeBytes: file.size, sourceType: "local_upload" } });
      controller.current = await startResumableUpload({ file, bucket: prepared.bucket, objectPath: prepared.objectPath, onProgress: (uploaded, total) => setProgress(total ? uploaded / total : 0), onError: (cause) => { setError(cause.message); setState("failed"); }, onComplete: async () => { try { await completeSourceUpload({ data: { assetId: prepared.assetId } }); setProgress(1); setState("complete"); onUploaded({ assetId: prepared.assetId, filename: file.name, durationSeconds: duration }); } catch (cause) { setError(cause instanceof Error ? cause.message : "Upload finalisation failed."); setState("failed"); } } });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Upload preparation failed."); setState("failed"); }
  };
  const pause = async () => { await controller.current?.abort(); setState("paused"); };
  return <div className="rounded-2xl border border-dashed border-line-strong bg-surface-raised p-5">
    {!file ? <label className="flex cursor-pointer flex-col items-center gap-3 py-7 text-center"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-ember-soft text-ember-ink"><Upload className="h-5 w-5" /></span><span className="text-sm font-medium text-ink">Choose the authorised original</span><span className="text-xs text-ink-mute">MP4, MOV, MKV, WebM or M4V · up to 10 GB</span><input className="sr-only" type="file" accept="video/mp4,video/quicktime,video/x-matroska,video/webm,video/x-m4v" onChange={(event) => choose(event.target.files?.[0])} /></label> : <div><div className="flex items-center gap-3"><FileVideo className="h-5 w-5 text-ember" /><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-ink">{file.name}</div><div className="text-xs text-ink-mute">{(file.size / 1024 ** 2).toFixed(1)} MB{duration ? ` · ${Math.ceil(duration / 60)} source minutes` : ""}</div></div>{state !== "uploading" && state !== "complete" && <button onClick={() => { setFile(null); setState("empty"); }} aria-label="Remove file"><X className="h-4 w-4 text-ink-mute" /></button>}</div>{state !== "ready" && <div className="mt-4"><div className="h-2 overflow-hidden rounded-full bg-surface-sunken"><div className="h-full bg-ember transition-all" style={{ width: `${Math.round(progress * 100)}%` }} /></div><div className="mt-2 flex justify-between text-xs text-ink-mute"><span>{state === "complete" ? "Upload complete · worker validation queued" : state === "paused" ? "Upload paused" : state === "failed" ? "Upload interrupted" : "Uploading bytes"}</span><span>{Math.round(progress * 100)}%</span></div></div>}<div className="mt-4 flex gap-2">{state === "ready" && <button type="button" onClick={upload} className="rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-surface-page">Start resumable upload</button>}{state === "uploading" && <button type="button" onClick={pause} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs text-ink"><CirclePause className="h-3.5 w-3.5" />Pause</button>}{(state === "paused" || state === "failed") && <button type="button" onClick={() => { controller.current?.retry(); setState("uploading"); }} className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-surface-page"><RotateCcw className="h-3.5 w-3.5" />Resume</button>}</div></div>}
    {error && <p role="alert" className="mt-3 text-xs text-danger">{error}</p>}
  </div>;
}
