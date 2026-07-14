import { Link, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Clock3,
  LoaderCircle,
  RotateCcw,
  Scissors,
  X,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatUtcDate } from "@/lib/format-date";
import { cancelClipJob, type getClipJob } from "@/services/clipping/server";
import { getExportDownload } from "@/services/exports/server";
import { YouTubePublishPanel } from "./youtube-publish-panel";

type JobData = Awaited<ReturnType<typeof getClipJob>>;
const stages = [
  "queued",
  "validating",
  "creating_proxy",
  "extracting_audio",
  "transcribing",
  "analysing",
  "planning",
  "rendering_previews",
  "ready",
];

export function JobProgress({
  data,
  youtubeConnection = null,
  publishingJobs = [],
}: {
  data: JobData;
  youtubeConnection?: Parameters<typeof YouTubePublishPanel>[0]["connection"];
  publishingJobs?: Parameters<typeof YouTubePublishPanel>[0]["jobs"];
}) {
  const router = useRouter();
  const { job, events, clips, exports } = data;
  useEffect(() => {
    const channel = getSupabaseBrowserClient()
      .channel(`clip-job-${job.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "clip_jobs", filter: `id=eq.${job.id}` },
        () => router.invalidate(),
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "processing_events",
          filter: `clip_job_id=eq.${job.id}`,
        },
        () => router.invalidate(),
      )
      .subscribe();
    return () => {
      void getSupabaseBrowserClient().removeChannel(channel);
    };
  }, [job.id, router]);
  const currentIndex = stages.indexOf(job.status);
  const terminal = ["failed", "cancelled", "expired"].includes(job.status);
  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[.14em] text-ember-ink">
            YouTube Clipper job
          </div>
          <h1 className="mt-2 font-display text-3xl text-ink">
            {job.source_title ?? "Authorised source"}
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            {job.completed_clip_count}/{job.requested_clip_count} previews ready · retained until{" "}
            {formatUtcDate(job.retention_expires_at)}
          </p>
        </div>
        {!terminal && (
          <button
            onClick={async () => {
              await cancelClipJob({ data: { jobId: job.id } });
              await router.invalidate();
            }}
            className="inline-flex items-center gap-2 self-start rounded-lg border border-line px-3 py-2 text-sm text-ink-soft"
          >
            <X className="h-4 w-4" />
            Cancel job
          </button>
        )}
      </div>
      <div className="mt-7 rounded-2xl border border-line bg-surface-panel p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {terminal ? (
              <AlertTriangle className="h-5 w-5 text-danger" />
            ) : ["ready", "partially_ready", "completed"].includes(job.status) ? (
              <Check className="h-5 w-5 text-success" />
            ) : (
              <LoaderCircle className="h-5 w-5 animate-spin text-ember motion-reduce:animate-none" />
            )}
            <span className="font-medium capitalize text-ink">
              {job.status.replaceAll("_", " ")}
            </span>
          </div>
          <span className="text-xs text-ink-mute">
            Progress uses completed work, not estimated percentages
          </span>
        </div>
        <div className="mt-5 grid grid-cols-4 gap-1 sm:grid-cols-9">
          {stages.map((stage, index) => (
            <div key={stage}>
              <div
                className={`h-1.5 rounded-full ${index <= currentIndex || ["ready", "partially_ready", "completed"].includes(job.status) ? "bg-ember" : "bg-line"}`}
              />
              <div className="mt-1 hidden truncate text-[9px] capitalize text-ink-mute sm:block">
                {stage.replaceAll("_", " ")}
              </div>
            </div>
          ))}
        </div>
        {job.error_message && (
          <div className="mt-5 rounded-xl border border-danger/25 bg-danger/5 p-4 text-sm text-danger">
            <div className="font-semibold">Processing stopped</div>
            <div className="mt-1">{job.error_message}</div>
            <button className="mt-3 inline-flex items-center gap-1.5 font-medium">
              <RotateCcw className="h-3.5 w-3.5" />
              Retry failed task
            </button>
          </div>
        )}
      </div>
      {clips.length > 0 && (
        <section className="mt-8">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-ink-mute">Results</div>
              <h2 className="mt-1 font-display text-2xl text-ink">Recommended moments</h2>
            </div>
            <button className="rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-surface-page">
              Export selected
            </button>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clips.map((clip, index) => (
              <article
                key={clip.id}
                className="overflow-hidden rounded-2xl border border-line bg-surface-panel"
              >
                <div className="flex aspect-[9/16] max-h-72 items-center justify-center bg-gradient-to-b from-[#4b4038] to-[#191b1a]">
                  <Scissors className="h-7 w-7 text-white/40" />
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-medium text-ink">{clip.title}</h3>
                    <span className="font-mono text-sm text-ember-ink">#{index + 1}</span>
                  </div>
                  <div className="mt-2 text-xs text-ink-mute">
                    {Number(clip.duration_seconds).toFixed(1)} sec · {clip.status}
                  </div>
                  <Link
                    to="/app/youtube-clipper/clips/$clipId/edit"
                    params={{ clipId: clip.id }}
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ember-ink"
                  >
                    Edit clip
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
      {exports.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-xl text-ink">Exports</h2>
          <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-surface-panel">
            {exports.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 text-sm last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium capitalize text-ink">
                    {item.export_type.replaceAll("_", " ")} · {item.format.toUpperCase()}
                  </div>
                  <div className="mt-0.5 text-xs text-ink-mute">
                    {item.resolution} · {item.watermarked ? "Vidrial watermark" : "No watermark"} ·
                    expires {formatUtcDate(item.expires_at)}
                  </div>
                </div>
                {item.status === "complete" ? (
                  <button
                    onClick={async () => {
                      const download = await getExportDownload({ data: { exportId: item.id } });
                      window.location.assign(download.url);
                    }}
                    className="rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-surface-page"
                  >
                    Download
                  </button>
                ) : (
                  <span className="rounded-full bg-surface-sunken px-3 py-1 text-xs capitalize text-ink-soft">
                    {item.status}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      <YouTubePublishPanel
        exports={exports}
        connection={youtubeConnection}
        jobs={publishingJobs}
        defaultTitle={job.source_title ?? "Vidrial clip"}
      />
      <section className="mt-8">
        <div className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-ink-mute" />
          <h2 className="font-display text-xl text-ink">Processing events</h2>
        </div>
        <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-surface-panel">
          {events.length ? (
            events.map((event) => (
              <div
                key={event.id}
                className="grid grid-cols-[100px_1fr_auto] gap-3 border-b border-line px-4 py-3 text-xs last:border-0"
              >
                <span className="capitalize text-ink-mute">{event.stage.replaceAll("_", " ")}</span>
                <span className="text-ink-soft">{event.message}</span>
                <span className="text-ink-mute">
                  {event.progress_total
                    ? `${event.progress_current ?? 0}/${event.progress_total}`
                    : new Date(event.created_at).toLocaleTimeString()}
                </span>
              </div>
            ))
          ) : (
            <div className="px-4 py-6 text-sm text-ink-mute">
              The job is waiting for its first worker event.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
