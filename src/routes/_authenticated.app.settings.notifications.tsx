import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { userFacingError } from "@/lib/user-facing-error";
import { getAccountPreferences, saveNotificationPreferences } from "@/services/settings/server";

export const Route = createFileRoute("/_authenticated/app/settings/notifications")({
  loader: () => getAccountPreferences(),
  component: Notifications,
});

function Notifications() {
  const loaded = Route.useLoaderData();
  const router = useRouter();
  const [values, setValues] = useState(loaded.notifications);
  const [saving, setSaving] = useState(false);

  return (
    <section className="max-w-xl rounded-2xl border border-line bg-surface-panel p-6">
      <h2 className="font-display text-lg text-ink">Notification preferences</h2>
      <p className="mt-1 text-sm text-ink-soft">Choose which account and production updates you want to receive.</p>
      <div className="mt-5 divide-y divide-line">
        <Toggle label="Export completed" checked={values.exportComplete} onChange={(checked) => setValues((current) => ({ ...current, exportComplete: checked }))} />
        <Toggle label="AI analysis completed" checked={values.aiPlanComplete} onChange={(checked) => setValues((current) => ({ ...current, aiPlanComplete: checked }))} />
        <Toggle label="Weekly usage summary" checked={values.weeklyUsage} onChange={(checked) => setValues((current) => ({ ...current, weeklyUsage: checked }))} />
        <Toggle label="Product updates" checked={values.productUpdates} onChange={(checked) => setValues((current) => ({ ...current, productUpdates: checked }))} />
      </div>
      <div className="mt-5 flex justify-end"><Button loading={saving} loadingText="Saving…" onClick={async () => { setSaving(true); try { await saveNotificationPreferences({ data: values }); toast.success("Notification preferences saved."); await router.invalidate(); } catch (cause) { toast.error(userFacingError(cause, "Notification preferences could not be saved.")); } finally { setSaving(false); } }}><Save />Save notifications</Button></div>
    </section>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex min-h-14 items-center justify-between gap-4 py-3 text-sm text-ink"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 accent-ember" /></label>;
}
