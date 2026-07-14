import { createFileRoute, useRouter } from "@tanstack/react-router";
import { RotateCcw, Save } from "lucide-react";
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
import { userFacingError } from "@/lib/user-facing-error";
import {
  getAccountPreferences,
  resetAccountPreferences,
  saveEditorPreferences,
} from "@/services/settings/server";

export const Route = createFileRoute("/_authenticated/app/settings/preferences")({
  loader: () => getAccountPreferences(),
  component: Preferences,
});

function Preferences() {
  const loaded = Route.useLoaderData();
  const router = useRouter();
  const [values, setValues] = useState(loaded.editor);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await saveEditorPreferences({ data: values });
      toast.success("Editor preferences saved.");
      await router.invalidate();
    } catch (cause) {
      toast.error(userFacingError(cause, "Preferences could not be saved."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="max-w-xl rounded-2xl border border-line bg-surface-panel p-6">
      <h2 className="font-display text-lg text-ink">Editor defaults</h2>
      <p className="mt-1 text-sm text-ink-soft">These preferences follow your account across devices.</p>
      <div className="mt-5 divide-y divide-line">
        <Toggle label="Show AI plan preview before applying" checked={values.aiPlanPreview} onChange={(checked) => setValues((current) => ({ ...current, aiPlanPreview: checked }))} />
        <Toggle label="Snap timeline edits to precise increments" checked={values.snapToWords} onChange={(checked) => setValues((current) => ({ ...current, snapToWords: checked }))} />
        <Toggle label="Use a bandwidth-saving editing preview" checked={values.lowResolutionPreview} onChange={(checked) => setValues((current) => ({ ...current, lowResolutionPreview: checked }))} />
        <label className="flex min-h-14 items-center justify-between gap-4 py-3 text-sm text-ink">
          Autosave interval
          <select value={values.autosaveSeconds} onChange={(event) => setValues((current) => ({ ...current, autosaveSeconds: Number(event.target.value) }))} className="min-h-11 rounded-md border border-line bg-surface-page px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ember">
            <option value={0}>Off</option><option value={15}>15 seconds</option><option value={30}>30 seconds</option><option value={60}>1 minute</option><option value={120}>2 minutes</option>
          </select>
        </label>
      </div>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <AlertDialog>
          <AlertDialogTrigger asChild><Button variant="outline"><RotateCcw />Reset all preferences</Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Reset account preferences?</AlertDialogTitle><AlertDialogDescription>This restores editor and notification preferences to their recommended defaults on every device.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction disabled={resetting} onClick={async (event) => { event.preventDefault(); setResetting(true); try { const result = await resetAccountPreferences({ data: { confirmation: "RESET" } }); setValues(result.editor); toast.success("Preferences reset."); await router.invalidate(); } catch (cause) { toast.error(userFacingError(cause, "Preferences could not be reset.")); setResetting(false); } }}>{resetting ? "Resetting…" : "Reset preferences"}</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Button onClick={() => void save()} loading={saving} loadingText="Saving…"><Save />Save preferences</Button>
      </div>
    </section>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex min-h-14 items-center justify-between gap-4 py-3 text-sm text-ink"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 accent-ember" /></label>;
}
