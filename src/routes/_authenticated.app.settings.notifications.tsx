import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/settings/notifications")({
  component: Notifs,
});

function Notifs() {
  return (
    <div className="max-w-xl space-y-3 rounded-2xl border border-line bg-surface-panel p-6 text-sm text-ink">
      <Row label="Export completed" on />
      <Row label="AI plan finished analysing project" on />
      <Row label="Weekly usage summary" />
      <Row label="Product updates" />
    </div>
  );
}

function Row({ label, on }: { label: string; on?: boolean }) {
  return (
    <label className="flex items-center justify-between gap-4 border-b border-line pb-3 last:border-b-0 last:pb-0">
      <span>{label}</span>
      <input type="checkbox" defaultChecked={on} className="h-4 w-4 accent-ember" />
    </label>
  );
}