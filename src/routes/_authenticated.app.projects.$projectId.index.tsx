import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { FileText, Film, History, Package, Save, Trash2, Wand2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Callout } from "@/components/primitives/section";
import { Button } from "@/components/ui/button";
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
import { userFacingError } from "@/lib/user-facing-error";
import { deleteProject, getProject, updateProject } from "@/services/projects/server";

export const Route = createFileRoute("/_authenticated/app/projects/$projectId/")({
  loader: ({ params }) => getProject({ data: { projectId: params.projectId } }),
  component: Overview,
});

function Overview() {
  const { project, assets, versions, jobs } = Route.useLoaderData();
  const navigate = useNavigate();
  const router = useRouter();
  const preview = assets.find((asset) => asset.previewUrl && asset.mime_type?.startsWith("video/"));
  const [name, setName] = useState(project.name);
  const [brief, setBrief] = useState(project.brief);
  const [aspect, setAspect] = useState<"16:9" | "9:16" | "1:1">(
    project.aspect as "16:9" | "9:16" | "1:1",
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updateProject({ data: { projectId: project.id, name, aspect, brief } });
      toast.success("Project details saved.");
      await router.invalidate();
    } catch (cause) {
      toast.error(userFacingError(cause, "Project details could not be saved."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <section className="rounded-2xl border border-line bg-surface-panel p-5 sm:p-6">
        {preview ? (
          <video
            src={preview.previewUrl ?? undefined}
            controls
            preload="metadata"
            className="aspect-video w-full rounded-xl bg-ink"
          />
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-xl bg-surface-sunken px-5 text-center text-sm text-ink-mute">
            Upload a video in Media to enable the project preview.
          </div>
        )}

        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <h2 className="font-display text-xl text-ink">Project details</h2>
          <label className="grid gap-1.5 text-sm text-ink">
            Project name
            <input
              required
              minLength={1}
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="min-h-11 rounded-md border border-line bg-surface-page px-3 outline-none focus-visible:ring-2 focus-visible:ring-ember"
            />
          </label>
          <label className="grid gap-1.5 text-sm text-ink">
            Default aspect ratio
            <select
              value={aspect}
              onChange={(event) => setAspect(event.target.value as typeof aspect)}
              className="min-h-11 rounded-md border border-line bg-surface-page px-3 outline-none focus-visible:ring-2 focus-visible:ring-ember"
            >
              <option value="16:9">16:9 landscape</option>
              <option value="9:16">9:16 vertical</option>
              <option value="1:1">1:1 square</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-sm text-ink">
            Editing brief
            <textarea
              rows={6}
              maxLength={5000}
              value={brief}
              onChange={(event) => setBrief(event.target.value)}
              className="rounded-md border border-line bg-surface-page p-3 outline-none focus-visible:ring-2 focus-visible:ring-ember"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={saving} loadingText="Saving…">
              <Save />
              Save details
            </Button>
            <Button asChild variant="outline">
              <Link to="/app/projects/$projectId/editor" params={{ projectId: project.id }}>
                <Wand2 />
                Open editor
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/app/projects/$projectId/transcript" params={{ projectId: project.id }}>
                <FileText />
                Transcript
              </Link>
            </Button>
          </div>
        </form>
      </section>

      <aside className="space-y-3">
        <Callout tone="success" title="Private workspace">
          Project data, uploads and versions are securely saved to your account.
        </Callout>
        <Metric icon={Film} label="Assets" value={String(assets.length)} />
        <Metric icon={FileText} label="Processing jobs" value={String(jobs.length)} />
        <Metric icon={History} label="Versions" value={String(versions.length)} />
        <Metric
          icon={Package}
          label="Completed clips"
          value={String(jobs.reduce((sum, job) => sum + job.completed_clip_count, 0))}
        />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="w-full border-danger/40 text-danger">
              <Trash2 />
              Delete project
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete “{project.name}”?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes the project and schedules its uploaded media for secure
                deletion. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={deleting}
                className="bg-danger text-white hover:bg-danger/90"
                onClick={async (event) => {
                  event.preventDefault();
                  setDeleting(true);
                  try {
                    await deleteProject({
                      data: { projectId: project.id, confirmation: "DELETE" },
                    });
                    toast.success("Project deleted.");
                    await navigate({ to: "/app/projects" });
                  } catch (cause) {
                    toast.error(userFacingError(cause, "The project could not be deleted."));
                    setDeleting(false);
                  }
                }}
              >
                {deleting ? "Deleting…" : "Delete project"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </aside>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Film; label: string; value: string }) {
  return (
    <div className="flex min-h-11 items-center justify-between rounded-xl border border-line bg-surface-panel px-4 py-3">
      <span className="flex items-center gap-2 text-sm text-ink-soft">
        <Icon aria-hidden className="h-4 w-4 text-ember" />
        {label}
      </span>
      <span className="tabular-nums text-sm text-ink">{value}</span>
    </div>
  );
}
