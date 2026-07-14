import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Download, Film, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/primitives/status-dot";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  deleteExport,
  getExportDownload,
  listProjectExportData,
  requestClipExport,
} from "@/services/exports/server";
import { userFacingError } from "@/lib/user-facing-error";

export const Route = createFileRoute("/_authenticated/app/projects/$projectId/exports")({
  loader: ({ params }) => listProjectExportData({ data: { projectId: params.projectId } }),
  component: ExportsPage,
});
function ExportsPage() {
  const { clips, exports } = Route.useLoaderData();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const date = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
  const request = async (clip: { id: string; current_version_id: string }) => {
    setBusy(clip.id);
    setMessage(null);
    try {
      await requestClipExport({
        data: {
          clipId: clip.id,
          clipVersionId: clip.current_version_id,
          captionMode: "both",
          idempotencyKey: crypto.randomUUID(),
        },
      });
      setMessage("Export queued. Progress updates automatically as the worker renders it.");
      toast.success("Export queued.");
      await router.invalidate();
    } catch (cause) {
      const friendly = userFacingError(cause, "Export could not be queued.");
      setMessage(friendly);
      toast.error(friendly);
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-line bg-surface-panel p-5">
        <h2 className="font-display text-lg text-ink">Export-ready clips</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Each export is rendered by FFmpeg and delivered through a 5-minute private signed URL.
        </p>
        <div className="mt-4 grid gap-2">
          {clips
            .filter((clip) => clip.current_version_id)
            .map((clip) => (
              <div
                key={clip.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface-raised p-3"
              >
                <Film className="h-4 w-4 text-ember" />
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{clip.title}</span>
                <Button
                  size="sm"
                  onClick={() => void request(clip as { id: string; current_version_id: string })}
                  loading={busy === clip.id}
                  loadingText="Queuing…"
                >
                  Export MP4 + captions
                </Button>
              </div>
            ))}
          {clips.filter((clip) => clip.current_version_id).length === 0 && (
            <p className="py-6 text-center text-sm text-ink-mute">
              Process project media and save a clip version before exporting.
            </p>
          )}
        </div>
      </section>
      <p role="status" aria-live="polite" className="min-h-5 text-sm text-ink-soft">
        {message}
      </p>
      <ul className="space-y-2">
        {exports.map((item) => (
          <li key={item.id} className="rounded-xl border border-line bg-surface-panel p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium uppercase text-ink">
                  {item.format} · {item.resolution}
                </div>
                <div className="mt-1 text-xs text-ink-mute">
                  Created {date.format(new Date(item.created_at))}
                  {item.size_bytes
                    ? ` · ${(Number(item.size_bytes) / 1024 / 1024).toFixed(1)} MB`
                    : ""}
                </div>
              </div>
              <StatusDot
                variant={
                  item.status === "complete"
                    ? "success"
                    : item.status === "failed"
                      ? "danger"
                      : "info"
                }
              >
                {item.status}
              </StatusDot>
              {item.status === "complete" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    setBusy(item.id);
                    try {
                      const result = await getExportDownload({ data: { exportId: item.id } });
                      window.location.assign(result.url);
                    } catch (cause) {
                      toast.error(userFacingError(cause, "The download link could not be created."));
                    } finally {
                      setBusy(null);
                    }
                  }}
                  loading={busy === item.id}
                  loadingText="Signing…"
                >
                  <Download />
                  Download
                </Button>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="icon" variant="ghost" aria-label="Delete export">
                    <Trash2 />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this export?</AlertDialogTitle>
                    <AlertDialogDescription>
                      The rendered file and export record will be permanently removed.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-danger text-white"
                      onClick={async (event) => {
                        event.preventDefault();
                        try {
                          await deleteExport({ data: { exportId: item.id, confirmation: "DELETE" } });
                          toast.success("Export deleted.");
                          await router.invalidate();
                        } catch (cause) {
                          toast.error(userFacingError(cause, "The export could not be deleted."));
                        }
                      }}
                    >
                      Delete export
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            {!["complete", "failed"].includes(item.status) && (
              <div
                className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-sunken"
                role="progressbar"
                aria-label="Export rendering in progress"
                aria-valuetext={item.status}
              >
                <div className="h-full w-1/2 animate-pulse bg-ember motion-reduce:animate-none" />
              </div>
            )}
          </li>
        ))}
        {exports.length === 0 && (
          <li className="rounded-xl border border-dashed border-line p-10 text-center text-sm text-ink-mute">
            No exports requested yet.
          </li>
        )}
      </ul>
    </div>
  );
}
