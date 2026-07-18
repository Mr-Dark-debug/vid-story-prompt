import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowRight, Clock3, Plus, Scissors, Trash2 } from "lucide-react";
import { useState } from "react";
import { AppPageHeader } from "@/components/app/layout";
import { deleteClipJob, listClipJobs } from "@/services/clipping/server";
import { formatUtcDateTime } from "@/lib/format-date";
import { ResilientThumbnail } from "@/components/media/resilient-thumbnail";
import { ConfirmationDialog, StatusDialog } from "@/components/ui/status-dialog";
import { JobStatusBadge } from "@/components/youtube-clipper/job-status-badge";

export const Route = createFileRoute("/_authenticated/app/youtube-clipper/")({
  loader: () => listClipJobs(),
  component: ClipperDashboard,
});

type ClipJobSummary = {
  id: string;
  source_title: string | null;
  source_thumbnail_url: string | null;
  status: string;
  requested_clip_count: number;
  completed_clip_count: number;
  created_at: string;
};

function ClipperDashboard() {
  const jobs = Route.useLoaderData();
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<ClipJobSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteClipJob({ data: { jobId: deleteTarget.id } });
      setDeleteTarget(null);
      await router.invalidate();
    } catch (cause) {
      setDeleteTarget(null);
      setDeleteError(
        cause instanceof Error
          ? cause.message.replaceAll("_", " ")
          : "The clipping job could not be deleted.",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <AppPageHeader
        eyebrow="YouTube Clipper"
        title="Clipping jobs"
        description="Turn authorised long-form sources into explainable, editable short clips."
        actions={
          <Link
            to="/app/youtube-clipper/new"
            className="inline-flex items-center gap-2 rounded-lg bg-ink px-3.5 py-2 text-sm font-semibold text-surface-page"
          >
            <Plus className="h-4 w-4" />
            New clipping job
          </Link>
        }
      />

      {jobs.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-line-strong bg-surface-panel px-6 py-16 text-center">
          <Scissors className="mx-auto h-8 w-8 text-ember" />
          <h2 className="mt-4 font-display text-xl text-ink">No clipping jobs yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
            Add an authorised YouTube video, upload the original, or import an owner-controlled
            media URL.
          </p>
          <Link
            to="/app/youtube-clipper/new"
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-ember-ink"
          >
            Create your first job
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {jobs.map((job: ClipJobSummary) => (
            <article
              key={job.id}
              className="flex items-center gap-3 rounded-2xl border border-line bg-surface-panel p-3 transition hover:border-line-strong sm:gap-4 sm:p-4"
            >
              <ResilientThumbnail
                src={job.source_thumbnail_url}
                alt={`Thumbnail for ${job.source_title ?? "clipping job"}`}
                className="h-16 w-24 shrink-0 rounded-lg sm:w-28"
              />
              <div className="min-w-0 flex-1">
                <Link
                  to="/app/youtube-clipper/jobs/$jobId"
                  params={{ jobId: job.id }}
                  className="block truncate font-medium text-ink hover:text-ember-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember"
                >
                  {job.source_title ?? "Untitled source"}
                </Link>
                <div className="mt-1 flex items-center gap-2 text-xs text-ink-mute">
                  <Clock3 className="h-3.5 w-3.5" />
                  {formatUtcDateTime(job.created_at)} · {job.completed_clip_count}/
                  {job.requested_clip_count} clips
                </div>
              </div>
              <JobStatusBadge status={job.status} className="hidden sm:inline-flex" />
              <button
                type="button"
                aria-label={`Delete ${job.source_title ?? "clipping job"}`}
                onClick={() => setDeleteTarget(job)}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-ink-mute transition hover:bg-danger/5 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <Link
                to="/app/youtube-clipper/jobs/$jobId"
                params={{ jobId: job.id }}
                aria-label={`Open ${job.source_title ?? "clipping job"}`}
                className="hidden h-11 w-11 shrink-0 place-items-center rounded-xl text-ink-mute hover:bg-surface-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember sm:grid"
              >
                <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          ))}
        </div>
      )}
      <ConfirmationDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
        title="Delete this clipping job?"
        description="Its clips, exports, and private source assets will be queued for permanent deletion. This cannot be undone."
        confirmLabel="Delete job"
        destructive
        busy={deleting}
        onConfirm={confirmDelete}
      />
      <StatusDialog
        open={Boolean(deleteError)}
        onOpenChange={(open) => {
          if (!open) setDeleteError(null);
        }}
        variant="error"
        title="The job could not be deleted"
        description={deleteError ?? "Try again in a moment."}
        primaryAction={{ label: "Try again" }}
      />
    </div>
  );
}
