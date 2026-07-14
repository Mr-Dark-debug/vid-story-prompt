import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { Download, Save, Undo2 } from "lucide-react";
import { TimelineView } from "@/components/editor/timeline";
import { useTimeline } from "@/domain/timeline/store";
import { saveClipVersion, type getClipForEditor } from "@/services/clipping/server";
import { requestClipExport } from "@/services/exports/server";
import { formatUtcDateTime } from "@/lib/format-date";

type EditorData = Awaited<ReturnType<typeof getClipForEditor>>;
export function ClipEditor({ data }: { data: EditorData }) {
  const router = useRouter();
  const { clip, versions } = data;
  const latest = versions[0];
  const raw = latest?.edit_manifest_json;
  const saved = typeof raw === "object" && raw ? (raw as Record<string, unknown>) : {};
  const [start, setStart] = useState(Number(saved.startSeconds ?? 0));
  const [end, setEnd] = useState(Number(saved.endSeconds ?? clip.duration_seconds));
  const [aspect, setAspect] = useState<"9:16" | "1:1" | "16:9">(
    (saved.aspectRatio as "9:16") ?? "9:16",
  );
  const [cropMode, setCropMode] = useState<"fit" | "fill" | "centre" | "blur" | "manual">(
    (saved.cropMode as "centre") ?? "centre",
  );
  const [captions, setCaptions] = useState(
    String(
      (saved.captions as Record<string, unknown> | undefined)?.text ??
        "Correct the transcript and captions here.",
    ),
  );
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const reset = useTimeline((state) => state.reset);
  useEffect(() => {
    reset({
      clips: [
        {
          id: clip.id,
          assetId: clip.preview_asset_id ?? clip.id,
          name: clip.title,
          trackId: "vt1",
          start: 0,
          in: start,
          out: end,
          kind: "video",
        },
        {
          id: `${clip.id}-captions`,
          assetId: clip.id,
          name: "Editable captions",
          trackId: "ct1",
          start: 0,
          in: start,
          out: end,
          kind: "caption",
        },
      ],
    });
  }, [clip.id, clip.preview_asset_id, clip.title, end, reset, start]);
  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const result = await saveClipVersion({
        data: {
          clipId: clip.id,
          manifest: {
            startSeconds: start,
            endSeconds: end,
            aspectRatio: aspect,
            cropMode,
            focalPoint: { x: 0.5, y: 0.5 },
            captions: {
              text: captions,
              preset: "Clean editorial",
              position: "bottom",
              activeWord: true,
              profanityMask: false,
            },
            audio: { gainDb: 0, muted: false, fadeInSeconds: 0.15, fadeOutSeconds: 0.15 },
          },
        },
      });
      setMessage(`Version ${result.versionNumber} saved.`);
      await router.invalidate();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };
  const requestExport = async () => {
    const versionId = versions[0]?.id;
    if (!versionId) {
      setMessage("Save a clip version before exporting.");
      return;
    }
    setExporting(true);
    setMessage(null);
    try {
      const result = await requestClipExport({
        data: {
          clipId: clip.id,
          clipVersionId: versionId,
          captionMode: "both",
          idempotencyKey: crypto.randomUUID(),
        },
      });
      setMessage(
        `${result.resolution} export queued${result.watermarked ? " with Vidrial watermark" : result.trialConsumed ? " using your trial export" : " without watermark"}.`,
      );
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Export request failed.");
    } finally {
      setExporting(false);
    }
  };
  const field =
    "h-10 rounded-lg border border-line bg-surface-page px-3 text-sm outline-none focus:border-ember";
  return (
    <div className="-mx-5 -my-8 flex min-h-dvh flex-col bg-surface-page sm:-mx-8">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-panel px-5 py-4">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-ink-mute">
            YouTube Clipper editor
          </div>
          <h1 className="font-display text-xl text-ink">{clip.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          {message && (
            <span role="status" className="text-xs text-ink-soft">
              {message}
            </span>
          )}
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm text-ink">
            <Undo2 className="h-4 w-4" />
            Restore suggested
          </button>
          <button
            disabled={exporting}
            onClick={requestExport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink"
          >
            <Download className="h-4 w-4" />
            {exporting ? "Queueing…" : "Export"}
          </button>
          <button
            disabled={saving}
            onClick={save}
            className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-surface-page"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save version"}
          </button>
        </div>
      </header>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_340px]">
        <main className="flex min-h-[560px] flex-col border-r border-line">
          <div className="flex flex-1 items-center justify-center bg-[#181918] p-6">
            <div
              className={`relative flex max-h-[60vh] items-center justify-center overflow-hidden rounded-xl bg-gradient-to-b from-[#57483d] to-[#1c1d1c] shadow-2xl ${aspect === "9:16" ? "aspect-[9/16] h-full" : aspect === "1:1" ? "aspect-square w-3/4" : "aspect-video w-full"}`}
            >
              <div className="absolute inset-x-4 bottom-[12%] rounded-lg bg-black/75 px-3 py-2 text-center text-sm font-semibold text-white">
                {captions.split(/\s+/).slice(0, 8).join(" ")}
              </div>
            </div>
          </div>
          <div className="h-52">
            <TimelineView />
          </div>
        </main>
        <aside className="overflow-y-auto bg-surface-panel p-5">
          <section>
            <h2 className="font-display text-lg text-ink">Timing</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-xs text-ink-mute">
                Start
                <input
                  type="number"
                  step=".1"
                  min="0"
                  value={start}
                  onChange={(event) => setStart(Number(event.target.value))}
                  className={field}
                />
              </label>
              <label className="grid gap-1 text-xs text-ink-mute">
                End
                <input
                  type="number"
                  step=".1"
                  min={start + 0.1}
                  value={end}
                  onChange={(event) => setEnd(Number(event.target.value))}
                  className={field}
                />
              </label>
            </div>
          </section>
          <section className="mt-6 border-t border-line pt-5">
            <h2 className="font-display text-lg text-ink">Crop</h2>
            <label className="mt-3 grid gap-1 text-xs text-ink-mute">
              Aspect ratio
              <select
                value={aspect}
                onChange={(event) => setAspect(event.target.value as typeof aspect)}
                className={field}
              >
                {["9:16", "1:1", "16:9"].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label className="mt-3 grid gap-1 text-xs text-ink-mute">
              Layout
              <select
                value={cropMode}
                onChange={(event) => setCropMode(event.target.value as typeof cropMode)}
                className={field}
              >
                {["fit", "fill", "centre", "blur", "manual"].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <div className="mt-3 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-ink-soft">
              Safe-area overlay is visible in preview. Centre crop is not presented as AI tracking.
            </div>
          </section>
          <section className="mt-6 border-t border-line pt-5">
            <h2 className="font-display text-lg text-ink">Captions</h2>
            <textarea
              value={captions}
              onChange={(event) => setCaptions(event.target.value)}
              rows={8}
              className="mt-3 w-full rounded-xl border border-line bg-surface-page p-3 text-sm leading-relaxed outline-none focus:border-ember"
            />
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-ink-soft">
              <button className="rounded-lg border border-line px-3 py-2">Split cue</button>
              <button className="rounded-lg border border-line px-3 py-2">Merge cue</button>
              <button className="rounded-lg border border-line px-3 py-2">SRT</button>
              <button className="rounded-lg border border-line px-3 py-2">VTT</button>
            </div>
          </section>
          <section className="mt-6 border-t border-line pt-5">
            <h2 className="font-display text-lg text-ink">Versions</h2>
            <div className="mt-3 space-y-2">
              {versions.map((version) => (
                <div
                  key={version.id}
                  className="rounded-lg border border-line px-3 py-2 text-xs text-ink-soft"
                >
                  Version {version.version_number} · {formatUtcDateTime(version.created_at)}
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
