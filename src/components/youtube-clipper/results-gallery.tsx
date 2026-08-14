import { Link, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, Check, LoaderCircle, RefreshCw, Scissors, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  clipStrengthBand,
  clipStrengthLabel,
  type ClipStrengthBand,
} from "@/domain/clipping/score-presentation";
import { regenerateClipTitle } from "@/services/clipping/server";
import { requestBatchExport } from "@/services/exports/server";

type Candidate = {
  id: string;
  start_seconds: number;
  end_seconds: number;
  title: string;
  summary: string;
  standalone_score: number;
  hook_score: number;
  clarity_score: number;
  story_score: number;
  relevance_score: number;
  overall_score: number;
  selection_reason: string;
  social_copy_json: unknown;
  rank: number | null;
};

type Clip = {
  id: string;
  clip_candidate_id: string | null;
  current_version_id: string | null;
  duration_seconds: number;
  preview_url: string | null;
  status: string;
};

const bandClasses: Record<ClipStrengthBand, string> = {
  strong: "border-success/30 bg-success/10 text-success",
  promising: "border-warning/35 bg-warning/10 text-warning",
  needs_work: "border-danger/25 bg-danger/5 text-danger",
  limited: "border-line bg-surface-sunken text-ink-mute",
};

function socialCopyEntries(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim().length > 0,
  );
}

export function ResultsGallery({
  candidates,
  clips,
  exports = [],
  jobId,
  titleRegenerationAvailable,
}: {
  candidates: Candidate[];
  clips: Clip[];
  exports?: { clip_id: string | null; status: string; export_type: string }[];
  jobId: string;
  titleRegenerationAvailable: boolean;
}) {
  const router = useRouter();
  const [minimumScore, setMinimumScore] = useState(0);
  const [sort, setSort] = useState<"score" | "rank" | "duration">("score");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const rows = useMemo(() => {
    const clipByCandidate = new Map(clips.map((clip) => [clip.clip_candidate_id, clip]));
    return candidates
      .map((candidate) => ({ candidate, clip: clipByCandidate.get(candidate.id) ?? null }))
      .filter((row) => Number(row.candidate.overall_score) >= minimumScore)
      .sort((a, b) => {
        if (sort === "rank") return (a.candidate.rank ?? 999) - (b.candidate.rank ?? 999);
        if (sort === "duration") {
          return (
            Number(b.candidate.end_seconds) -
            Number(b.candidate.start_seconds) -
            (Number(a.candidate.end_seconds) - Number(a.candidate.start_seconds))
          );
        }
        return Number(b.candidate.overall_score) - Number(a.candidate.overall_score);
      });
  }, [candidates, clips, minimumScore, sort]);

  const toggle = (clipId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(clipId)) next.delete(clipId);
      else next.add(clipId);
      return next;
    });
  };

  const exportSelected = async () => {
    const selectedClips = clips.filter((clip) => selected.has(clip.id));
    if (!selectedClips.length) return;
    const completedClipIds = new Set(
      exports
        .filter((item) => item.status === "complete" && item.export_type !== "batch" && item.clip_id)
        .map((item) => item.clip_id),
    );
    if (
      selectedClips.some(
        (clip) => !clip.current_version_id || !completedClipIds.has(clip.id),
      )
    ) {
      toast.error("Export each selected clip once before packaging the completed videos into a ZIP.");
      return;
    }
    setExporting(true);
    try {
      await requestBatchExport({
        data: { jobId, clipIds: selectedClips.map((clip) => clip.id), idempotencyKey: crypto.randomUUID() },
      });
      toast.success(`Batch export queued for ${selectedClips.length} clips.`);
      await router.invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The batch export could not be queued.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="mt-8" aria-labelledby="clip-results-heading">
      <div className="rounded-2xl border border-line bg-surface-panel p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.14em] text-ember-ink">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Explainable selection
            </div>
            <h2 id="clip-results-heading" className="mt-1 font-display text-2xl text-ink">
              Recommended moments
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-soft">
              Scores compare hook, clarity, standalone meaning, and story completeness. They are
              editing guidance, not a promise of reach.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs font-medium text-ink-soft">
              Minimum strength
              <select
                value={minimumScore}
                onChange={(event) => setMinimumScore(Number(event.target.value))}
                className="mt-1 block min-h-10 rounded-lg border border-line bg-surface-page px-3 text-sm text-ink"
              >
                <option value={0}>All scores</option>
                <option value={40}>40+</option>
                <option value={65}>65+</option>
                <option value={80}>80+</option>
              </select>
            </label>
            <label className="text-xs font-medium text-ink-soft">
              Sort by
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as typeof sort)}
                className="mt-1 block min-h-10 rounded-lg border border-line bg-surface-page px-3 text-sm text-ink"
              >
                <option value="score">Highest score</option>
                <option value="rank">Recommended order</option>
                <option value="duration">Longest first</option>
              </select>
            </label>
            <button
              type="button"
              disabled={!selected.size || exporting}
              onClick={() => void exportSelected()}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-surface-page disabled:cursor-not-allowed disabled:opacity-45"
            >
              {exporting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Export selected{selected.size ? ` (${selected.size})` : ""}
            </button>
          </div>
        </div>
      </div>

      {rows.length ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ candidate, clip }) => {
            const score = Math.round(Number(candidate.overall_score));
            const band = clipStrengthBand(score);
            const copy = socialCopyEntries(candidate.social_copy_json);
            const isSelected = clip ? selected.has(clip.id) : false;
            return (
              <article
                key={candidate.id}
                className={cn(
                  "group overflow-hidden rounded-2xl border bg-surface-panel transition-[border-color,transform,box-shadow] duration-200 motion-reduce:transition-none",
                  isSelected
                    ? "border-ember shadow-[0_12px_35px_rgba(29,30,28,.12)]"
                    : "border-line hover:-translate-y-0.5 hover:border-line-strong",
                )}
              >
                <div className="relative aspect-video overflow-hidden bg-surface-sunken">
                  {clip?.preview_url ? (
                    <video
                      controls
                      preload="metadata"
                      playsInline
                      src={clip.preview_url}
                      className="h-full w-full bg-black object-contain"
                      aria-label={`Preview: ${candidate.title}`}
                    />
                  ) : (
                    <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_30%_20%,rgba(222,108,67,.18),transparent_42%),linear-gradient(145deg,var(--color-surface-sunken),var(--color-surface-panel))]">
                      <Scissors className="h-7 w-7 text-ink-mute" aria-hidden="true" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "absolute left-3 top-3 rounded-full border px-3 py-1 text-xs font-bold backdrop-blur",
                      bandClasses[band],
                    )}
                    aria-label={`${clipStrengthLabel[band]} clip strength: ${score} out of 100`}
                  >
                    {score} · {clipStrengthLabel[band]}
                  </div>
                  {clip ? (
                    <label className="absolute right-3 top-3 inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border border-white/20 bg-black/65 px-3 text-xs font-semibold text-white backdrop-blur">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggle(clip.id)}
                        className="h-4 w-4 accent-[var(--color-ember)]"
                      />
                      Select
                    </label>
                  ) : null}
                </div>
                <div className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="min-w-0 text-balance font-display text-xl leading-tight text-ink">
                      {candidate.title}
                    </h3>
                    <span className="shrink-0 font-mono text-xs text-ink-mute">
                      #{candidate.rank ?? "—"}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink-soft">{candidate.summary}</p>
                  <div className="mt-4 grid grid-cols-4 gap-1 rounded-xl bg-surface-sunken p-2 text-center">
                    {[
                      ["Hook", candidate.hook_score],
                      ["Clarity", candidate.clarity_score],
                      ["Standalone", candidate.standalone_score],
                      ["Story", candidate.story_score],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="min-w-0 px-1">
                        <div className="font-mono text-sm font-semibold text-ink">{Math.round(Number(value))}</div>
                        <div className="truncate text-[9px] uppercase tracking-wide text-ink-mute">{label}</div>
                      </div>
                    ))}
                  </div>
                  <details className="mt-3 rounded-xl border border-line px-3 py-2 text-sm">
                    <summary className="cursor-pointer font-semibold text-ink">Why this score</summary>
                    <p className="mt-2 leading-6 text-ink-soft">{candidate.selection_reason}</p>
                  </details>
                  {copy.length ? (
                    <details className="mt-2 rounded-xl border border-line px-3 py-2 text-sm">
                      <summary className="cursor-pointer font-semibold text-ink">Platform copy</summary>
                      <div className="mt-2 space-y-3">
                        {copy.map(([platform, value]) => (
                          <div key={platform}>
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-mute">
                              {platform.replace(/([A-Z])/g, " $1")}
                            </div>
                            <p className="mt-1 whitespace-pre-line leading-5 text-ink-soft">{value}</p>
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : null}
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {clip ? (
                      <Link
                        to="/app/youtube-clipper/clips/$clipId/edit"
                        params={{ clipId: clip.id }}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-ink px-3 text-sm font-semibold text-surface-page"
                      >
                        Edit clip <ArrowRight className="h-4 w-4" />
                      </Link>
                    ) : null}
                    {clip ? (
                      <button
                        type="button"
                        disabled={!titleRegenerationAvailable || regenerating === clip.id}
                        title={
                          titleRegenerationAvailable
                            ? "Generate a different title for this clip"
                            : "Title regeneration is not configured"
                        }
                        onClick={async () => {
                          setRegenerating(clip.id);
                          try {
                            await regenerateClipTitle({ data: { clipId: clip.id } });
                            toast.success("A new title and platform copy were saved.");
                            await router.invalidate();
                          } catch (error) {
                            toast.error(
                              error instanceof Error ? error.message : "The title could not be regenerated.",
                            );
                          } finally {
                            setRegenerating(null);
                          }
                        }}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-ember-ink disabled:cursor-not-allowed disabled:text-ink-mute"
                      >
                        <RefreshCw className={cn("h-4 w-4", regenerating === clip.id && "animate-spin")} />
                        Regenerate title
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-line p-8 text-center text-sm text-ink-mute">
          No candidates match this score filter.
        </div>
      )}
    </section>
  );
}
