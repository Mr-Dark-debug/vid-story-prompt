import { createFileRoute } from "@tanstack/react-router";
import { StatusDot } from "@/components/primitives/status-dot";

export const Route = createFileRoute("/_authenticated/app/settings/preferences")({
  component: Prefs,
});

function Prefs() {
  return (
    <div className="max-w-xl space-y-3 rounded-2xl border border-line bg-surface-panel p-6 text-sm text-ink">
      <Toggle label="Show AI plan preview before applying" defaultOn />
      <Toggle label="Autosave every 30 seconds" defaultOn />
      <Toggle label="Snap clips to nearest word boundary" defaultOn />
      <Toggle label="Play preview at low resolution to save battery" />
      <StatusDot variant="demo">Preferences apply in this browser</StatusDot>
    </div>
  );
}

function Toggle({ label, defaultOn }: { label: string; defaultOn?: boolean }) {
  return (
    <label className="flex items-center justify-between gap-4 border-b border-line pb-3 last:border-b-0 last:pb-0">
      <span>{label}</span>
      <input type="checkbox" defaultChecked={defaultOn} className="h-4 w-4 accent-ember" />
    </label>
  );
}