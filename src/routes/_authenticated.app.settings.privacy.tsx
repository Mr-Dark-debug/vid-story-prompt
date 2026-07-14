import { createFileRoute } from "@tanstack/react-router";
import { Download, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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
import { deleteMyAccount, exportMyData } from "@/services/privacy/server";
import { userFacingError } from "@/lib/user-facing-error";

export const Route = createFileRoute("/_authenticated/app/settings/privacy")({
  head: () => ({ meta: [{ title: "Privacy settings — Vidrial" }] }),
  component: Privacy,
});
function Privacy() {
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const download = async () => {
    setExporting(true);
    setMessage(null);
    try {
      const data = await exportMyData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `vidrial-data-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage("Your account data export was downloaded.");
      toast.success("Account data downloaded.");
    } catch (cause) {
      const friendly = userFacingError(cause, "Data export failed. Try again.");
      setMessage(friendly);
      toast.error(friendly);
    } finally {
      setExporting(false);
    }
  };
  return (
    <div className="max-w-2xl space-y-4">
      <section className="rounded-2xl border border-line bg-surface-panel p-6">
        <h2 className="font-display text-lg text-ink">Your data</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Download a machine-readable copy of your profile, projects, media metadata, clipping jobs,
          versions, exports and integration settings.
        </p>
        <Button
          className="mt-4"
          variant="outline"
          onClick={() => void download()}
          loading={exporting}
          loadingText="Preparing export…"
        >
          <Download />
          Download my data
        </Button>
      </section>
      <section className="rounded-2xl border border-danger/30 bg-danger/5 p-6">
        <h2 className="font-display text-lg text-ink">Delete account</h2>
        <p className="mt-1 text-sm text-ink-soft">
          This removes stored media, exports, projects, OAuth connections and the authentication
          account. This action cannot be undone.
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button className="mt-4" variant="destructive">
              <Trash2 />
              Delete my account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Permanently delete your Vidrial account?</AlertDialogTitle>
              <AlertDialogDescription>
                Type DELETE to confirm. Your session will stop working immediately after deletion.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <label className="grid gap-1.5 text-sm text-ink">
              Confirmation
              <input
                autoComplete="off"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                className="min-h-11 rounded-md border border-line bg-surface-page px-3"
              />
            </label>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={confirmation !== "DELETE" || deleting}
                className="bg-danger text-white"
                onClick={async (event) => {
                  event.preventDefault();
                  setDeleting(true);
                  setMessage(null);
                  try {
                    await deleteMyAccount({ data: { confirmation: "DELETE" } });
                    window.location.assign("/");
                  } catch (cause) {
                    const friendly = userFacingError(cause, "Account deletion failed. Try again.");
                    setMessage(friendly);
                    toast.error(friendly);
                    setDeleting(false);
                  }
                }}
              >
                {deleting ? "Deleting…" : "Delete account permanently"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
      <p role="status" aria-live="polite" className="min-h-5 text-sm text-ink-soft">
        {message}
      </p>
    </div>
  );
}
