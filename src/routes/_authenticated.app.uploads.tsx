import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Pencil, Trash2, UploadCloud } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppPageHeader } from "@/components/app/layout";
import { SourceUpload } from "@/components/youtube-clipper/source-upload";
import { StatusDot } from "@/components/primitives/status-dot";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { userFacingError } from "@/lib/user-facing-error";
import {
  deleteMediaAsset,
  listWorkspaceUploads,
  renameMediaAsset,
} from "@/services/projects/server";

export const Route = createFileRoute("/_authenticated/app/uploads")({
  head: () => ({ meta: [{ title: "Uploads — Vidrial" }] }),
  loader: () => listWorkspaceUploads(),
  pendingComponent: UploadsSkeleton,
  component: Uploads,
});

function Uploads() {
  const uploads = Route.useLoaderData();
  const router = useRouter();
  const date = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });

  return (
    <div>
      <AppPageHeader
        title="Uploads"
        eyebrow="Private media library"
        description="Resumable uploads are stored privately and validated before processing."
      />
      <section className="mb-6 rounded-2xl border border-line bg-surface-panel p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-ink">
          <UploadCloud className="h-4 w-4 text-ember" />
          Add video
        </div>
        <SourceUpload
          onUploaded={() => {
            toast.success("Upload complete.");
            void router.invalidate();
          }}
        />
      </section>
      <ul className="overflow-hidden rounded-2xl border border-line bg-surface-panel">
        {uploads.map((upload) => (
          <UploadRow
            key={upload.id}
            upload={upload}
            formattedDate={date.format(new Date(upload.created_at))}
            onChanged={() => router.invalidate()}
          />
        ))}
        {uploads.length === 0 ? (
          <li className="px-5 py-12 text-center">
            <UploadCloud className="mx-auto h-6 w-6 text-ink-mute" />
            <p className="mt-3 text-sm font-medium text-ink">No uploaded media yet</p>
            <p className="mt-1 text-sm text-ink-mute">Add your first authorised video above.</p>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function UploadRow({
  upload,
  formattedDate,
  onChanged,
}: {
  upload: Awaited<ReturnType<typeof listWorkspaceUploads>>[number];
  formattedDate: string;
  onChanged: () => Promise<void>;
}) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [name, setName] = useState(upload.display_name);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  return (
    <li className="flex min-w-0 flex-wrap items-center gap-3 border-b border-line px-4 py-3 last:border-0 sm:flex-nowrap">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-ink">{upload.display_name}</div>
        <div className="mt-1 text-xs text-ink-mute">
          {(Number(upload.size_bytes || 0) / 1024 / 1024).toFixed(1)} MB ·{" "}
          {Math.round(Number(upload.duration_seconds || 0))}s · {formattedDate} UTC
        </div>
      </div>
      <StatusDot
        variant={
          upload.status === "uploaded" || upload.status === "ready"
            ? "success"
            : upload.status === "failed"
              ? "danger"
              : "info"
        }
      >
        {upload.status}
      </StatusDot>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogTrigger asChild>
          <Button size="icon" variant="ghost" aria-label={`Rename ${upload.display_name}`}>
            <Pencil />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename upload</DialogTitle>
            <DialogDescription>
              Change the display name. The original private media file is not modified.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setRenaming(true);
              try {
                await renameMediaAsset({ data: { assetId: upload.id, displayName: name } });
                toast.success("Upload renamed.");
                setRenameOpen(false);
                await onChanged();
              } catch (cause) {
                toast.error(userFacingError(cause, "The upload could not be renamed."));
              } finally {
                setRenaming(false);
              }
            }}
          >
            <label className="grid gap-1.5 text-sm text-ink">
              Display name
              <input
                autoFocus
                required
                maxLength={255}
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="min-h-11 rounded-md border border-line bg-surface-page px-3 outline-none focus-visible:ring-2 focus-visible:ring-ember"
              />
            </label>
            <DialogFooter className="mt-5">
              <Button type="button" variant="outline" onClick={() => setRenameOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={renaming} loadingText="Saving…">
                Save name
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="icon" variant="ghost" aria-label={`Delete ${upload.display_name}`}>
            <Trash2 />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this upload?</AlertDialogTitle>
            <AlertDialogDescription>
              “{upload.display_name}” will be removed from private storage. Existing completed
              exports are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-danger text-white"
              onClick={async (event) => {
                event.preventDefault();
                setDeleting(true);
                try {
                  await deleteMediaAsset({ data: { assetId: upload.id, confirmation: "DELETE" } });
                  toast.success("Upload deleted.");
                  await onChanged();
                } catch (cause) {
                  toast.error(userFacingError(cause, "The upload could not be deleted."));
                  setDeleting(false);
                }
              }}
            >
              {deleting ? "Deleting…" : "Delete upload"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

function UploadsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading uploads" className="space-y-4">
      <div className="h-10 w-48 animate-pulse rounded bg-surface-sunken motion-reduce:animate-none" />
      <div className="h-44 animate-pulse rounded-2xl bg-surface-sunken motion-reduce:animate-none" />
      <div className="h-52 animate-pulse rounded-2xl bg-surface-sunken motion-reduce:animate-none" />
    </div>
  );
}
