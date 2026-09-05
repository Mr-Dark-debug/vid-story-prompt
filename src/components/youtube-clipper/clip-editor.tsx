import { useMemo, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { motion } from "motion/react";
import {
  Download,
  GitCompare,
  Plus,
  Redo2,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
  Undo2,
} from "lucide-react";
import {
  regenerateClipTitle,
  restoreClipVersion,
  saveClipVersion,
  type getClipForEditor,
} from "@/services/clipping/server";
import { requestClipExport } from "@/services/exports/server";
import { formatUtcDateTime } from "@/lib/format-date";
import { SelectField } from "@/components/ui/select-field";
import {
  defaultEditManifest,
  normalizeEditManifest,
  type EditManifest,
} from "@/domain/clipping/edit-manifest";
import { cn } from "@/lib/utils";

type EditorData = Awaited<ReturnType<typeof getClipForEditor>>;
type ManifestUpdater = EditManifest | ((current: EditManifest) => EditManifest);

const fontPreview: Record<EditManifest["captions"]["fontPreset"], string> = {
  clean_sans: "font-sans",
  editorial_serif: "font-serif",
  mono_signal: "font-mono",
};

const previewProfanity = new Set(["fuck", "fucking", "shit", "bitch", "asshole", "damn"]);

function captionPreviewWord(value: string, masked: boolean) {
  if (!masked) return value;
  const normalized = value.toLocaleLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  return previewProfanity.has(normalized) ? value.replace(/[\p{L}\p{N}]/gu, "●") : value;
}

function srtTime(seconds: number) {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
}

function downloadCaptions(manifest: EditManifest, format: "srt" | "vtt") {
  const cues = manifest.captions.cues.length
    ? manifest.captions.cues
    : [
        {
          startSeconds: 0,
          endSeconds: manifest.endSeconds - manifest.startSeconds,
          text: manifest.captions.text,
          words: [],
        },
      ];
  const body = cues
    .map((cue, index) => {
      const start = srtTime(cue.startSeconds);
      const end = srtTime(cue.endSeconds);
      return `${format === "srt" ? `${index + 1}\n` : ""}${format === "vtt" ? start.replace(",", ".") : start} --> ${format === "vtt" ? end.replace(",", ".") : end}\n${cue.text}\n`;
    })
    .join("\n");
  const blob = new Blob([format === "vtt" ? `WEBVTT\n\n${body}` : body], {
    type: format === "vtt" ? "text/vtt" : "application/x-subrip",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${manifest.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "clip"}.${format}`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function proportionalCues(text: string, duration: number) {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const chunks: string[][] = [];
  for (let index = 0; index < words.length; index += 8) chunks.push(words.slice(index, index + 8));
  return chunks.map((chunk, index) => {
    const startSeconds = (index / chunks.length) * duration;
    const endSeconds = ((index + 1) / chunks.length) * duration;
    const wordDuration = (endSeconds - startSeconds) / chunk.length;
    return {
      startSeconds,
      endSeconds,
      text: chunk.join(" "),
      words: chunk.map((textValue, wordIndex) => ({
        startSeconds: startSeconds + wordIndex * wordDuration,
        endSeconds: startSeconds + (wordIndex + 1) * wordDuration,
        text: textValue,
      })),
    };
  });
}

export function ClipEditor({ data }: { data: EditorData }) {
  const router = useRouter();
  const { candidate, clip, previewUrl, versions } = data;
  const fallback = useMemo(
    () =>
      defaultEditManifest({
        durationSeconds: Number(clip.duration_seconds),
        socialCopy: candidate?.social_copy_json,
        text: candidate?.transcript_excerpt ?? "Correct the transcript and captions here.",
        title: candidate?.title ?? clip.title,
      }),
    [candidate, clip.duration_seconds, clip.title],
  );
  const initial = useMemo(
    () => normalizeEditManifest(versions[0]?.edit_manifest_json, fallback),
    [fallback, versions],
  );
  const [history, setHistory] = useState<EditManifest[]>([initial]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const manifest = history[historyIndex];
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [compareVersionId, setCompareVersionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [playbackTime, setPlaybackTime] = useState(0);

  const updateManifest = (updater: ManifestUpdater) => {
    setHistory((currentHistory) => {
      const current = currentHistory[historyIndex];
      const next = typeof updater === "function" ? updater(current) : updater;
      const nextHistory = [...currentHistory.slice(0, historyIndex + 1), next].slice(-50);
      setHistoryIndex(nextHistory.length - 1);
      return nextHistory;
    });
  };

  const activeCueIndex = manifest.captions.cues.findIndex(
    (cue) => playbackTime >= cue.startSeconds && playbackTime < cue.endSeconds,
  );
  const activeCue =
    activeCueIndex >= 0
      ? manifest.captions.cues[activeCueIndex]
      : proportionalCues(manifest.captions.text, manifest.endSeconds - manifest.startSeconds)[0];
  const compareVersion = versions.find((version) => version.id === compareVersionId);
  const compareManifest = compareVersion
    ? normalizeEditManifest(compareVersion.edit_manifest_json, fallback)
    : null;

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const result = await saveClipVersion({ data: { clipId: clip.id, manifest } });
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
    "h-10 min-w-0 rounded-lg border border-line bg-surface-page px-3 text-sm text-ink outline-none focus:border-ember";
  const previewAspect =
    manifest.aspectRatio === "9:16"
      ? "aspect-[9/16] h-full"
      : manifest.aspectRatio === "1:1"
        ? "aspect-square w-[min(78vw,70vh)]"
        : "aspect-video w-full max-w-5xl";
  const objectFit =
    manifest.cropMode === "fit" || manifest.cropMode === "blur" ? "contain" : "cover";

  return (
    <div className="-mx-5 -my-8 flex min-h-dvh flex-col bg-surface-page sm:-mx-8">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-panel px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-ink-mute">Clip settings</div>
          <h1 className="truncate font-display text-xl text-ink">{manifest.title}</h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {message ? (
            <span role="status" className="max-w-xs text-xs text-ink-soft">
              {message}
            </span>
          ) : null}
          <button
            type="button"
            disabled={historyIndex === 0}
            onClick={() => setHistoryIndex((index) => Math.max(0, index - 1))}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-line px-3 text-sm text-ink disabled:opacity-40"
          >
            <Undo2 className="h-4 w-4" /> Undo
          </button>
          <button
            type="button"
            disabled={historyIndex >= history.length - 1}
            onClick={() => setHistoryIndex((index) => Math.min(history.length - 1, index + 1))}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-line px-3 text-sm text-ink disabled:opacity-40"
          >
            <Redo2 className="h-4 w-4" /> Redo
          </button>
          <button
            type="button"
            disabled={exporting}
            onClick={() => void requestExport()}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-semibold text-ink"
          >
            <Download className="h-4 w-4" /> {exporting ? "Queueing…" : "Export"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-ink px-3 text-sm font-semibold text-surface-page"
          >
            <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save version"}
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 xl:grid-cols-[minmax(0,1fr)_380px]">
        <main className="flex min-h-[600px] min-w-0 flex-col border-r border-line">
          <div className="relative flex min-h-[420px] flex-1 items-center justify-center overflow-hidden bg-[#181918] p-4 sm:p-6">
            <div
              className={cn(
                "relative max-h-[66vh] overflow-hidden rounded-xl bg-[#242522] shadow-2xl",
                previewAspect,
              )}
            >
              {previewUrl ? (
                <>
                  {manifest.cropMode === "blur" ? (
                    <video
                      aria-hidden="true"
                      muted
                      src={previewUrl}
                      className="absolute inset-0 h-full w-full scale-110 object-cover opacity-65 blur-xl"
                    />
                  ) : null}
                  <video
                    controls
                    playsInline
                    preload="metadata"
                    src={previewUrl}
                    onTimeUpdate={(event) => setPlaybackTime(event.currentTarget.currentTime)}
                    className="relative h-full w-full bg-black"
                    style={{
                      objectFit,
                      objectPosition: `${manifest.focalPoint.x * 100}% ${manifest.focalPoint.y * 100}%`,
                    }}
                  />
                </>
              ) : (
                <div className="grid h-full min-h-96 place-items-center bg-[radial-gradient(circle_at_30%_20%,rgba(222,108,67,.2),transparent_45%),linear-gradient(155deg,#50443b,#1c1d1c)] text-sm text-white/55">
                  Preview is rendering
                </div>
              )}
              {manifest.safeArea ? (
                <div
                  className="pointer-events-none absolute inset-[8%] rounded-lg border border-dashed border-white/45"
                  aria-label="Safe area"
                />
              ) : null}
              {activeCue ? (
                <motion.div
                  key={`${activeCue.startSeconds}-${manifest.captions.animation}`}
                  initial={
                    manifest.captions.animation === "pop"
                      ? { opacity: 0, scale: 0.72 }
                      : { opacity: 1 }
                  }
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.18 }}
                  className={cn(
                    "pointer-events-none absolute inset-x-[7%] z-10 flex",
                    manifest.captions.position === "top" && "top-[10%] items-start",
                    manifest.captions.position === "middle" &&
                      "top-1/2 -translate-y-1/2 items-center",
                    manifest.captions.position === "bottom" && "bottom-[10%] items-end",
                    manifest.captions.alignment === "left" && "justify-start text-left",
                    manifest.captions.alignment === "center" && "justify-center text-center",
                    manifest.captions.alignment === "right" && "justify-end text-right",
                  )}
                >
                  <span
                    className={cn(
                      "rounded-md px-2 py-1 font-semibold leading-tight",
                      fontPreview[manifest.captions.fontPreset],
                    )}
                    style={{
                      color: manifest.captions.textColor,
                      backgroundColor: `${manifest.captions.backgroundColor}${Math.round(
                        manifest.captions.backgroundOpacity * 255,
                      )
                        .toString(16)
                        .padStart(2, "0")}`,
                      fontSize: `${Math.max(14, manifest.captions.fontSize / 3.4)}px`,
                      fontWeight: manifest.captions.fontWeight === "bold" ? 700 : 400,
                      textShadow: manifest.captions.shadow
                        ? `0 2px 4px ${manifest.captions.strokeColor}, 0 0 ${manifest.captions.strokeWidth}px ${manifest.captions.strokeColor}`
                        : undefined,
                    }}
                  >
                    {(activeCue.words.length
                      ? activeCue.words
                      : (proportionalCues(
                          activeCue.text,
                          activeCue.endSeconds - activeCue.startSeconds,
                        )[0]?.words ?? [])
                    ).map((word, index) => {
                      const highlighted =
                        manifest.captions.animation === "word_highlight" &&
                        playbackTime >= word.startSeconds &&
                        playbackTime < word.endSeconds;
                      const keyword = manifest.captions.keywordHighlight.some(
                        (candidate) =>
                          candidate.toLocaleLowerCase() ===
                          word.text
                            .toLocaleLowerCase()
                            .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""),
                      );
                      return (
                        <span
                          key={`${word.startSeconds}-${index}`}
                          style={{
                            color:
                              highlighted || keyword ? manifest.captions.highlightColor : undefined,
                          }}
                        >
                          {captionPreviewWord(word.text, manifest.captions.profanityMask)}{" "}
                        </span>
                      );
                    })}
                  </span>
                </motion.div>
              ) : null}
              {manifest.textOverlays
                .filter(
                  (overlay) =>
                    playbackTime >= overlay.startSeconds && playbackTime <= overlay.endSeconds,
                )
                .map((overlay) => (
                  <span
                    key={overlay.id}
                    className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded px-2 py-1 font-semibold"
                    style={{
                      left: `${overlay.x * 100}%`,
                      top: `${overlay.y * 100}%`,
                      color: overlay.textColor,
                      backgroundColor: overlay.backgroundColor,
                      fontSize: `${Math.max(12, overlay.fontSize / 3)}px`,
                    }}
                  >
                    {overlay.text}
                  </span>
                ))}
            </div>
          </div>
        </main>

        <aside className="overflow-y-auto bg-surface-panel p-5">
          <section>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-lg text-ink">Title and copy</h2>
              <button
                type="button"
                disabled={!data.titleRegenerationAvailable || regenerating}
                onClick={async () => {
                  setRegenerating(true);
                  try {
                    const result = await regenerateClipTitle({ data: { clipId: clip.id } });
                    updateManifest((current) => ({
                      ...current,
                      title: result.title,
                      socialCopy: result.socialCopy,
                    }));
                    setMessage("A new title and platform copy were generated.");
                  } catch (error) {
                    setMessage(
                      error instanceof Error ? error.message : "Title regeneration failed.",
                    );
                  } finally {
                    setRegenerating(false);
                  }
                }}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-ember-ink disabled:text-ink-mute"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", regenerating && "animate-spin")} />{" "}
                Regenerate
              </button>
            </div>
            <input
              aria-label="Clip title"
              value={manifest.title}
              maxLength={120}
              onChange={(event) =>
                updateManifest((current) => ({ ...current, title: event.target.value }))
              }
              className={cn(field, "mt-3 w-full")}
            />
            <details className="mt-3 rounded-lg border border-line p-3 text-xs text-ink-soft">
              <summary className="cursor-pointer font-semibold text-ink">Platform copy</summary>
              <div className="mt-3 space-y-3">
                {(Object.keys(manifest.socialCopy) as Array<keyof EditManifest["socialCopy"]>).map(
                  (platform) => (
                    <label key={platform} className="grid gap-1 capitalize">
                      {platform.replace(/([A-Z])/g, " $1")}
                      <textarea
                        value={manifest.socialCopy[platform]}
                        rows={3}
                        onChange={(event) =>
                          updateManifest((current) => ({
                            ...current,
                            socialCopy: { ...current.socialCopy, [platform]: event.target.value },
                          }))
                        }
                        className="rounded-lg border border-line bg-surface-page p-2 text-sm text-ink outline-none focus:border-ember"
                      />
                    </label>
                  ),
                )}
              </div>
            </details>
          </section>

          <section className="mt-6 border-t border-line pt-5">
            <h2 className="font-display text-lg text-ink">Timing</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-xs text-ink-mute">
                Start
                <input
                  type="number"
                  step=".1"
                  min="0"
                  value={manifest.startSeconds}
                  onChange={(event) =>
                    updateManifest((current) => ({
                      ...current,
                      startSeconds: Number(event.target.value),
                    }))
                  }
                  className={field}
                />
              </label>
              <label className="grid gap-1 text-xs text-ink-mute">
                End
                <input
                  type="number"
                  step=".1"
                  min={manifest.startSeconds + 0.1}
                  value={manifest.endSeconds}
                  onChange={(event) =>
                    updateManifest((current) => ({
                      ...current,
                      endSeconds: Number(event.target.value),
                    }))
                  }
                  className={field}
                />
              </label>
            </div>
          </section>

          <section className="mt-6 border-t border-line pt-5">
            <h2 className="font-display text-lg text-ink">Crop</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <SelectField
                label="Aspect ratio"
                value={manifest.aspectRatio}
                onValueChange={(value) =>
                  updateManifest((current) => ({
                    ...current,
                    aspectRatio: value as EditManifest["aspectRatio"],
                  }))
                }
                options={["9:16", "1:1", "16:9"].map((value) => ({ value, label: value }))}
              />
              <SelectField
                label="Layout"
                value={manifest.cropMode}
                onValueChange={(value) =>
                  updateManifest((current) => ({
                    ...current,
                    cropMode: value as EditManifest["cropMode"],
                  }))
                }
                options={["fit", "fill", "centre", "blur", "manual"].map((value) => ({
                  value,
                  label: value.charAt(0).toUpperCase() + value.slice(1),
                }))}
              />
            </div>
            <label className="mt-3 flex items-center justify-between gap-3 text-xs text-ink-soft">
              Safe-area overlay
              <input
                type="checkbox"
                checked={manifest.safeArea}
                onChange={(event) =>
                  updateManifest((current) => ({ ...current, safeArea: event.target.checked }))
                }
              />
            </label>
            {manifest.cropMode === "manual" ? (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="grid gap-1 text-xs text-ink-mute">
                  Focal X
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step=".01"
                    value={manifest.focalPoint.x}
                    onChange={(event) =>
                      updateManifest((current) => ({
                        ...current,
                        focalPoint: { ...current.focalPoint, x: Number(event.target.value) },
                      }))
                    }
                  />
                </label>
                <label className="grid gap-1 text-xs text-ink-mute">
                  Focal Y
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step=".01"
                    value={manifest.focalPoint.y}
                    onChange={(event) =>
                      updateManifest((current) => ({
                        ...current,
                        focalPoint: { ...current.focalPoint, y: Number(event.target.value) },
                      }))
                    }
                  />
                </label>
              </div>
            ) : null}
          </section>

          <section className="mt-6 border-t border-line pt-5">
            <h2 className="font-display text-lg text-ink">Captions</h2>
            <textarea
              value={manifest.captions.text}
              onChange={(event) =>
                updateManifest((current) => ({
                  ...current,
                  captions: { ...current.captions, text: event.target.value },
                }))
              }
              rows={7}
              className="mt-3 w-full rounded-xl border border-line bg-surface-page p-3 text-sm leading-relaxed text-ink outline-none focus:border-ember"
            />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <SelectField
                label="Font"
                value={manifest.captions.fontPreset}
                onValueChange={(value) =>
                  updateManifest((current) => ({
                    ...current,
                    captions: {
                      ...current.captions,
                      fontPreset: value as EditManifest["captions"]["fontPreset"],
                    },
                  }))
                }
                options={[
                  { value: "clean_sans", label: "Clean Sans" },
                  { value: "editorial_serif", label: "Editorial Serif" },
                  { value: "mono_signal", label: "Mono Signal" },
                ]}
              />
              <SelectField
                label="Animation"
                value={manifest.captions.animation}
                onValueChange={(value) =>
                  updateManifest((current) => ({
                    ...current,
                    captions: {
                      ...current.captions,
                      animation: value as EditManifest["captions"]["animation"],
                      activeWord: value === "word_highlight",
                    },
                  }))
                }
                options={[
                  { value: "none", label: "None" },
                  { value: "word_highlight", label: "Word highlight" },
                  { value: "line_reveal", label: "Line reveal" },
                  { value: "pop", label: "Pop in" },
                ]}
              />
              <SelectField
                label="Position"
                value={manifest.captions.position}
                onValueChange={(value) =>
                  updateManifest((current) => ({
                    ...current,
                    captions: {
                      ...current.captions,
                      position: value as EditManifest["captions"]["position"],
                    },
                  }))
                }
                options={["top", "middle", "bottom"].map((value) => ({
                  value,
                  label: value.charAt(0).toUpperCase() + value.slice(1),
                }))}
              />
              <SelectField
                label="Alignment"
                value={manifest.captions.alignment}
                onValueChange={(value) =>
                  updateManifest((current) => ({
                    ...current,
                    captions: {
                      ...current.captions,
                      alignment: value as EditManifest["captions"]["alignment"],
                    },
                  }))
                }
                options={["left", "center", "right"].map((value) => ({
                  value,
                  label: value.charAt(0).toUpperCase() + value.slice(1),
                }))}
              />
            </div>
            <label className="mt-3 grid gap-1 text-xs text-ink-mute">
              Font size · {manifest.captions.fontSize}
              <input
                type="range"
                min="24"
                max="120"
                value={manifest.captions.fontSize}
                onChange={(event) =>
                  updateManifest((current) => ({
                    ...current,
                    captions: { ...current.captions, fontSize: Number(event.target.value) },
                  }))
                }
              />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <SelectField
                label="Weight"
                value={manifest.captions.fontWeight}
                onValueChange={(value) =>
                  updateManifest((current) => ({
                    ...current,
                    captions: {
                      ...current.captions,
                      fontWeight: value as EditManifest["captions"]["fontWeight"],
                    },
                  }))
                }
                options={[
                  { value: "regular", label: "Regular" },
                  { value: "bold", label: "Bold" },
                ]}
              />
              <label className="grid gap-1 text-xs text-ink-mute">
                Background opacity
                <input
                  type="range"
                  min="0"
                  max="1"
                  step=".05"
                  value={manifest.captions.backgroundOpacity}
                  onChange={(event) =>
                    updateManifest((current) => ({
                      ...current,
                      captions: {
                        ...current.captions,
                        backgroundOpacity: Number(event.target.value),
                      },
                    }))
                  }
                />
              </label>
              <label className="grid gap-1 text-xs text-ink-mute">
                Text colour
                <input
                  type="color"
                  value={manifest.captions.textColor}
                  onChange={(event) =>
                    updateManifest((current) => ({
                      ...current,
                      captions: { ...current.captions, textColor: event.target.value },
                    }))
                  }
                  className="h-10 w-full rounded-lg border border-line bg-surface-page"
                />
              </label>
              <label className="grid gap-1 text-xs text-ink-mute">
                Highlight colour
                <input
                  type="color"
                  value={manifest.captions.highlightColor}
                  onChange={(event) =>
                    updateManifest((current) => ({
                      ...current,
                      captions: { ...current.captions, highlightColor: event.target.value },
                    }))
                  }
                  className="h-10 w-full rounded-lg border border-line bg-surface-page"
                />
              </label>
              <label className="grid gap-1 text-xs text-ink-mute">
                Background colour
                <input
                  type="color"
                  value={manifest.captions.backgroundColor}
                  onChange={(event) =>
                    updateManifest((current) => ({
                      ...current,
                      captions: { ...current.captions, backgroundColor: event.target.value },
                    }))
                  }
                  className="h-10 w-full rounded-lg border border-line bg-surface-page"
                />
              </label>
              <label className="grid gap-1 text-xs text-ink-mute">
                Stroke colour
                <input
                  type="color"
                  value={manifest.captions.strokeColor}
                  onChange={(event) =>
                    updateManifest((current) => ({
                      ...current,
                      captions: { ...current.captions, strokeColor: event.target.value },
                    }))
                  }
                  className="h-10 w-full rounded-lg border border-line bg-surface-page"
                />
              </label>
            </div>
            <label className="mt-3 grid gap-1 text-xs text-ink-mute">
              Stroke width Â· {manifest.captions.strokeWidth}
              <input
                type="range"
                min="0"
                max="8"
                step=".5"
                value={manifest.captions.strokeWidth}
                onChange={(event) =>
                  updateManifest((current) => ({
                    ...current,
                    captions: { ...current.captions, strokeWidth: Number(event.target.value) },
                  }))
                }
              />
            </label>
            <label className="mt-3 grid gap-1 text-xs text-ink-mute">
              Keyword highlights
              <input
                value={manifest.captions.keywordHighlight.join(", ")}
                placeholder="latency, architecture"
                onChange={(event) =>
                  updateManifest((current) => ({
                    ...current,
                    captions: {
                      ...current.captions,
                      keywordHighlight: event.target.value
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean)
                        .slice(0, 30),
                    },
                  }))
                }
                className={field}
              />
            </label>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-ink-soft">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={manifest.captions.shadow}
                  onChange={(event) =>
                    updateManifest((current) => ({
                      ...current,
                      captions: { ...current.captions, shadow: event.target.checked },
                    }))
                  }
                />{" "}
                Shadow
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={manifest.captions.profanityMask}
                  onChange={(event) =>
                    updateManifest((current) => ({
                      ...current,
                      captions: { ...current.captions, profanityMask: event.target.checked },
                    }))
                  }
                />{" "}
                Mask common profanity
              </label>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-ink-soft">
              <button
                type="button"
                onClick={() =>
                  updateManifest((current) => ({
                    ...current,
                    captions: {
                      ...current.captions,
                      cues: proportionalCues(
                        current.captions.text,
                        current.endSeconds - current.startSeconds,
                      ),
                    },
                  }))
                }
                className="rounded-lg border border-line px-2 py-2"
              >
                Split cues
              </button>
              <button
                type="button"
                onClick={() =>
                  updateManifest((current) => ({
                    ...current,
                    captions: {
                      ...current.captions,
                      cues: [
                        {
                          startSeconds: 0,
                          endSeconds: current.endSeconds - current.startSeconds,
                          text: current.captions.text,
                          words: proportionalCues(
                            current.captions.text,
                            current.endSeconds - current.startSeconds,
                          ).flatMap((cue) => cue.words),
                        },
                      ],
                    },
                  }))
                }
                className="rounded-lg border border-line px-2 py-2"
              >
                Merge cues
              </button>
              <button
                type="button"
                onClick={() => downloadCaptions(manifest, "srt")}
                className="rounded-lg border border-line px-2 py-2"
              >
                SRT
              </button>
              <button
                type="button"
                onClick={() => downloadCaptions(manifest, "vtt")}
                className="rounded-lg border border-line px-2 py-2"
              >
                VTT
              </button>
            </div>
          </section>

          <section className="mt-6 border-t border-line pt-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg text-ink">Text overlays</h2>
              <button
                type="button"
                onClick={() =>
                  updateManifest((current) => ({
                    ...current,
                    textOverlays: [
                      ...current.textOverlays,
                      {
                        id: crypto.randomUUID(),
                        text: "New text",
                        startSeconds: 0,
                        endSeconds: current.endSeconds - current.startSeconds,
                        x: 0.5,
                        y: 0.2,
                        fontSize: 44,
                        textColor: "#ffffff",
                        backgroundColor: "#00000080",
                      },
                    ],
                  }))
                }
                className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-ember-ink"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>
            <div className="mt-3 space-y-3">
              {manifest.textOverlays.map((overlay) => (
                <div key={overlay.id} className="rounded-xl border border-line p-3">
                  <div className="flex gap-2">
                    <input
                      aria-label="Overlay text"
                      value={overlay.text}
                      onChange={(event) =>
                        updateManifest((current) => ({
                          ...current,
                          textOverlays: current.textOverlays.map((item) =>
                            item.id === overlay.id ? { ...item, text: event.target.value } : item,
                          ),
                        }))
                      }
                      className={cn(field, "flex-1")}
                    />
                    <button
                      type="button"
                      aria-label="Remove overlay"
                      onClick={() =>
                        updateManifest((current) => ({
                          ...current,
                          textOverlays: current.textOverlays.filter(
                            (item) => item.id !== overlay.id,
                          ),
                        }))
                      }
                      className="grid h-10 w-10 place-items-center rounded-lg border border-line text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-3 text-xs text-ink-mute">
                    <label>
                      X
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step=".01"
                        value={overlay.x}
                        onChange={(event) =>
                          updateManifest((current) => ({
                            ...current,
                            textOverlays: current.textOverlays.map((item) =>
                              item.id === overlay.id
                                ? { ...item, x: Number(event.target.value) }
                                : item,
                            ),
                          }))
                        }
                      />
                    </label>
                    <label>
                      Y
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step=".01"
                        value={overlay.y}
                        onChange={(event) =>
                          updateManifest((current) => ({
                            ...current,
                            textOverlays: current.textOverlays.map((item) =>
                              item.id === overlay.id
                                ? { ...item, y: Number(event.target.value) }
                                : item,
                            ),
                          }))
                        }
                      />
                    </label>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-3 text-xs text-ink-mute">
                    <label>
                      Start
                      <input
                        type="number"
                        min="0"
                        step=".1"
                        value={overlay.startSeconds}
                        onChange={(event) =>
                          updateManifest((current) => ({
                            ...current,
                            textOverlays: current.textOverlays.map((item) =>
                              item.id === overlay.id
                                ? { ...item, startSeconds: Number(event.target.value) }
                                : item,
                            ),
                          }))
                        }
                        className={field}
                      />
                    </label>
                    <label>
                      End
                      <input
                        type="number"
                        min={overlay.startSeconds + 0.1}
                        step=".1"
                        value={overlay.endSeconds}
                        onChange={(event) =>
                          updateManifest((current) => ({
                            ...current,
                            textOverlays: current.textOverlays.map((item) =>
                              item.id === overlay.id
                                ? { ...item, endSeconds: Number(event.target.value) }
                                : item,
                            ),
                          }))
                        }
                        className={field}
                      />
                    </label>
                    <label>
                      Size
                      <input
                        type="range"
                        min="18"
                        max="120"
                        value={overlay.fontSize}
                        onChange={(event) =>
                          updateManifest((current) => ({
                            ...current,
                            textOverlays: current.textOverlays.map((item) =>
                              item.id === overlay.id
                                ? { ...item, fontSize: Number(event.target.value) }
                                : item,
                            ),
                          }))
                        }
                      />
                    </label>
                    <label>
                      Text colour
                      <input
                        type="color"
                        value={overlay.textColor}
                        onChange={(event) =>
                          updateManifest((current) => ({
                            ...current,
                            textOverlays: current.textOverlays.map((item) =>
                              item.id === overlay.id
                                ? { ...item, textColor: event.target.value }
                                : item,
                            ),
                          }))
                        }
                        className="h-9 w-full rounded border border-line"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-6 border-t border-line pt-5">
            <h2 className="font-display text-lg text-ink">Audio</h2>
            <label className="mt-3 grid gap-1 text-xs text-ink-mute">
              Gain · {manifest.audio.gainDb.toFixed(1)} dB
              <input
                type="range"
                min="-30"
                max="12"
                step=".5"
                value={manifest.audio.gainDb}
                onChange={(event) =>
                  updateManifest((current) => ({
                    ...current,
                    audio: { ...current.audio, gainDb: Number(event.target.value) },
                  }))
                }
              />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-xs text-ink-mute">
                Fade in
                <input
                  type="number"
                  min="0"
                  max="10"
                  step=".1"
                  value={manifest.audio.fadeInSeconds}
                  onChange={(event) =>
                    updateManifest((current) => ({
                      ...current,
                      audio: { ...current.audio, fadeInSeconds: Number(event.target.value) },
                    }))
                  }
                  className={field}
                />
              </label>
              <label className="grid gap-1 text-xs text-ink-mute">
                Fade out
                <input
                  type="number"
                  min="0"
                  max="10"
                  step=".1"
                  value={manifest.audio.fadeOutSeconds}
                  onChange={(event) =>
                    updateManifest((current) => ({
                      ...current,
                      audio: { ...current.audio, fadeOutSeconds: Number(event.target.value) },
                    }))
                  }
                  className={field}
                />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-ink-soft">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={manifest.audio.muted}
                  onChange={(event) =>
                    updateManifest((current) => ({
                      ...current,
                      audio: { ...current.audio, muted: event.target.checked },
                    }))
                  }
                />{" "}
                Mute
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={manifest.audio.normalize}
                  onChange={(event) =>
                    updateManifest((current) => ({
                      ...current,
                      audio: { ...current.audio, normalize: event.target.checked },
                    }))
                  }
                />{" "}
                Loudness normalization
              </label>
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
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-ink">
                        Version {version.version_number} · {version.created_source}
                      </div>
                      <div className="mt-0.5">{formatUtcDateTime(version.created_at)}</div>
                    </div>
                    <div className="flex">
                      <button
                        type="button"
                        aria-label={`Compare version ${version.version_number}`}
                        onClick={() =>
                          setCompareVersionId((current) =>
                            current === version.id ? null : version.id,
                          )
                        }
                        className="grid h-8 w-8 place-items-center rounded text-ink-soft"
                      >
                        <GitCompare className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Restore version ${version.version_number}`}
                        disabled={restoring === version.id}
                        onClick={async () => {
                          setRestoring(version.id);
                          try {
                            const result = await restoreClipVersion({
                              data: { clipId: clip.id, versionId: version.id },
                            });
                            setMessage(
                              `Version ${version.version_number} restored as version ${result.version_number}.`,
                            );
                            await router.invalidate();
                          } catch (error) {
                            setMessage(error instanceof Error ? error.message : "Restore failed.");
                          } finally {
                            setRestoring(null);
                          }
                        }}
                        className="grid h-8 w-8 place-items-center rounded text-ember-ink"
                      >
                        <RotateCcw
                          className={cn("h-4 w-4", restoring === version.id && "animate-spin")}
                        />
                      </button>
                    </div>
                  </div>
                  {compareVersionId === version.id && compareManifest ? (
                    <div className="mt-2 rounded bg-surface-sunken p-2 leading-5">
                      Title: {compareManifest.title}
                      <br />
                      Timing: {compareManifest.startSeconds.toFixed(1)}–
                      {compareManifest.endSeconds.toFixed(1)}s<br />
                      Crop: {compareManifest.aspectRatio} · {compareManifest.cropMode}
                      <br />
                      Captions: {compareManifest.captions.fontPreset.replaceAll("_", " ")} ·{" "}
                      {compareManifest.captions.animation.replaceAll("_", " ")}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
