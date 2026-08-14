import { useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock3,
  Info,
  LoaderCircle,
  RotateCcw,
  ShieldAlert,
  X,
  XCircle,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatUtcDate } from "@/lib/format-date";
import { cancelClipJob, retryClipJobTask, type getClipJob } from "@/services/clipping/server";
import { getExportDownload } from "@/services/exports/server";
import { deriveJobStages, type DisplayStageState } from "@/domain/clipping/job-progress";
import { cn } from "@/lib/utils";
import { StatusDialog } from "@/components/ui/status-dialog";
import { ConfirmationDialog } from "@/components/ui/status-dialog";
import { YouTubePublishPanel } from "./youtube-publish-panel";
import { JobStatusBadge } from "./job-status-badge";
import { AuthorisedSourceRecovery } from "./authorised-source-recovery";
import { WorkerEgressBadge } from "@/components/dashboard/WorkerEgressBadge";
import { sourceRecoveryMessage } from "@/domain/clipping/source-copy";
import { ResultsGallery } from "./results-gallery";
import { SocialPublishPanel } from "./social-publish-panel";

type JobData = Awaited<ReturnType<typeof getClipJob>>;
const retryableCodes = new Set([
  "provider_auth_challenge",
  "provider_rate_limited",
  "provider_temporary_failure",
  "download_timeout",
  "ytdlp_error",
  "video_restricted",
  "plan_unavailable",
  "temporary_failure",
]);

const stageClasses: Record<DisplayStageState, string> = {
  completed: "bg-success",
  active: "bg-ember",
  retrying: "bg-warning",
  failed: "bg-danger",
  pending: "bg-line",
};

export function JobProgress({
  data,
  youtubeConnection = null,
  publishingJobs = [],
  socialDestinations = [],
  socialPublishingJobs = [],
  configuredSocialPlatforms = [],
}: {
  data: JobData;
  youtubeConnection?: Parameters<typeof YouTubePublishPanel>[0]["connection"];
  publishingJobs?: Parameters<typeof YouTubePublishPanel>[0]["jobs"];
  socialDestinations?: Parameters<typeof SocialPublishPanel>[0]["destinations"];
  socialPublishingJobs?: Parameters<typeof SocialPublishPanel>[0]["jobs"];
  configuredSocialPlatforms?: string[];
}) {
  const router = useRouter();
  const { job, events, clips, exports, tasks } = data;
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "job_tasks", filter: `clip_job_id=eq.${job.id}` },
        () => router.invalidate(),
      )
      .subscribe();
    return () => {
      void getSupabaseBrowserClient().removeChannel(channel);
    };
  }, [job.id, router]);
  const stages = useMemo(() => deriveJobStages(job, tasks), [job, tasks]);
  const terminal = ["failed", "cancelled", "expired"].includes(job.status);
  const failedTask = [...tasks]
    .reverse()
    .find((task) => ["failed", "dead_lettered"].includes(task.status));
  const canRetry = Boolean(
    failedTask?.error_code &&
    retryableCodes.has(failedTask.error_code) &&
    failedTask.attempt < failedTask.max_attempts,
  );
  const awaitingAuthorisedSource = ["awaiting_authorised_source", "awaiting_local_relay"].includes(
    job.status,
  );
  const canForceProxy = Boolean(
    failedTask?.error_code &&
    ["provider_auth_challenge", "provider_rate_limited", "provider_temporary_failure"].includes(
      failedTask.error_code,
    ) &&
    !failedTask.force_proxy,
  );
  const acquisitionMessage = sourceRecoveryMessage(failedTask?.error_code, job.error_message);
  const orderedEvents = useMemo(() => [...events].reverse(), [events]);

  const retry = async (forceProxy = false) => {
    setRetrying(true);
    try {
      await retryClipJobTask({ data: { jobId: job.id, forceProxy } });
      await router.invalidate();
    } catch (cause) {
      setRetryError(cause instanceof Error ? cause.message : "The task could not be retried.");
    } finally {
      setRetrying(false);
    }
  };
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
            type="button"
            onClick={() => setConfirmCancel(true)}
            className="inline-flex min-h-11 items-center gap-2 self-start rounded-lg border border-line px-3 py-2 text-sm text-ink-soft transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X aria-hidden className="h-4 w-4" />
            Cancel job
          </button>
        )}
      </div>
      <div className="mt-7 rounded-2xl border border-line bg-surface-panel p-5">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="flex min-w-0 items-center gap-2">
            {terminal ? (
              <AlertTriangle aria-hidden className="h-5 w-5 shrink-0 text-danger" />
            ) : awaitingAuthorisedSource ? (
              <AlertTriangle aria-hidden className="h-5 w-5 shrink-0 text-warning" />
            ) : ["ready", "partially_ready", "completed"].includes(job.status) ? (
              <Check aria-hidden className="h-5 w-5 shrink-0 text-success" />
            ) : (
              <LoaderCircle
                aria-hidden
                className="h-5 w-5 shrink-0 animate-spin text-ember motion-reduce:animate-none"
              />
            )}
            <JobStatusBadge status={job.status} />
          </div>
          <span className="max-w-sm text-xs leading-5 text-ink-mute sm:text-right">
            Progress uses completed work, not estimated percentages
          </span>
        </div>
        <div className="mt-4">
          <WorkerEgressBadge />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-x-2 gap-y-4 sm:grid-cols-5 lg:grid-cols-10">
          {stages.map((stage) => (
            <div key={stage.id} aria-label={`${stage.label}: ${stage.state}`}>
              <div
                className={cn("h-1.5 rounded-full transition-colors", stageClasses[stage.state])}
              />
              <div className="mt-1.5 truncate text-[10px] text-ink-mute">{stage.label}</div>
            </div>
          ))}
        </div>
        {acquisitionMessage && (
          <div
            className={cn(
              "mt-5 rounded-xl border p-4 text-sm",
              awaitingAuthorisedSource
                ? "border-warning/30 bg-warning/10 text-ink"
                : "border-danger/25 bg-danger/5 text-danger",
            )}
          >
            <div className="font-semibold">
              {awaitingAuthorisedSource ? "Source action required" : "Processing stopped"}
            </div>
            <div className="mt-1 leading-6">{acquisitionMessage}</div>
            {job.youtube_video_id ? (
              <div className="mt-2 font-mono text-xs text-ink-soft">
                Failing video ID: {job.youtube_video_id}
              </div>
            ) : null}
            {canRetry && !awaitingAuthorisedSource && (
              <button
                type="button"
                disabled={retrying}
                onClick={() => void retry(false)}
                className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-lg px-1 font-semibold disabled:opacity-60"
              >
                <RotateCcw
                  className={cn(
                    "h-3.5 w-3.5",
                    retrying && "animate-spin motion-reduce:animate-none",
                  )}
                />
                {retrying ? "Queueing retry…" : "Retry failed task"}
              </button>
            )}
            {canForceProxy ? (
              <button
                type="button"
                disabled={retrying}
                onClick={() => void retry(true)}
                className="mt-3 ml-3 inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-danger/25 px-3 font-semibold disabled:opacity-60"
              >
                <ShieldAlert className="h-3.5 w-3.5" /> Retry automatic source access
              </button>
            ) : null}
          </div>
        )}
      </div>
      {awaitingAuthorisedSource ? (
        <AuthorisedSourceRecovery
          jobId={job.id}
          sourceAssetId={job.source_asset_id ?? null}
          errorCode={job.error_code ?? null}
          connectedConnectorIds={data.connectedConnectorIds}
          onResumed={() => router.invalidate()}
        />
      ) : null}
      {data.candidates.length > 0 ? (
        <ResultsGallery
          candidates={data.candidates}
          clips={clips}
          exports={exports}
          jobId={job.id}
          titleRegenerationAvailable={data.titleRegenerationAvailable}
        />
      ) : null}
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
      <SocialPublishPanel
        exports={exports}
        destinations={socialDestinations}
        jobs={socialPublishingJobs}
        configuredPlatforms={configuredSocialPlatforms}
        defaultTitle={job.source_title ?? "Vidrial clip"}
      />
      <section className="mt-8">
        <div className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-ink-mute" />
          <h2 className="font-display text-xl text-ink">Processing events</h2>
        </div>
        <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-surface-panel">
          {orderedEvents.length ? (
            orderedEvents.map((event, index) => {
              const EventIcon =
                event.severity === "error"
                  ? XCircle
                  : event.severity === "warning"
                    ? AlertTriangle
                    : event.progress_total && event.progress_current === event.progress_total
                      ? CheckCircle2
                      : Info;
              return (
                <div
                  key={event.id}
                  className="relative grid grid-cols-[2rem_1fr_auto] gap-3 px-4 py-4 text-xs"
                >
                  {index < orderedEvents.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-0 left-[1.95rem] top-10 w-px bg-line"
                    />
                  )}
                  <span
                    className={cn(
                      "relative z-10 grid h-8 w-8 place-items-center rounded-full border bg-surface-panel",
                      event.severity === "error" && "border-danger/30 text-danger",
                      event.severity === "warning" && "border-warning/35 text-warning",
                      event.severity === "info" && "border-line-strong text-ink-soft",
                    )}
                  >
                    <EventIcon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold capitalize text-ink">
                        {event.stage.replaceAll("_", " ")}
                      </span>
                      {event.attempt ? (
                        <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[10px] text-ink-mute">
                          Attempt {event.attempt}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 leading-relaxed text-ink-soft">{event.message}</p>
                    {event.progress_total ? (
                      <p className="mt-1 font-mono text-[10px] text-ink-mute">
                        {event.progress_current ?? 0}/{event.progress_total}
                      </p>
                    ) : null}
                  </div>
                  <time
                    className="pt-0.5 text-right text-[10px] text-ink-mute"
                    dateTime={event.created_at}
                    suppressHydrationWarning
                  >
                    {new Date(event.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
              );
            })
          ) : (
            <div className="px-4 py-6 text-sm text-ink-mute">
              The job is waiting for its first worker event.
            </div>
          )}
        </div>
      </section>
      <StatusDialog
        open={Boolean(retryError)}
        onOpenChange={(open) => {
          if (!open) setRetryError(null);
        }}
        variant="error"
        title="The task could not be retried"
        description={retryError ?? "Refresh the job and try again."}
        primaryAction={{ label: "Close" }}
      />
      <ConfirmationDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        destructive
        busy={cancelling}
        title="Cancel this clipping job?"
        description="Processing will stop and unfinished work will not be resumed. Completed clips and retained source files keep their existing retention rules."
        confirmLabel="Cancel job"
        onConfirm={async () => {
          setCancelling(true);
          try {
            await cancelClipJob({ data: { jobId: job.id } });
            setConfirmCancel(false);
            await router.invalidate();
          } catch (cause) {
            setRetryError(
              cause instanceof Error ? cause.message : "The job could not be cancelled.",
            );
          } finally {
            setCancelling(false);
          }
        }}
      />
    </div>
  );
}
