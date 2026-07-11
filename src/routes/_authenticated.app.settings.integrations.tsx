import { createFileRoute } from "@tanstack/react-router";
import { StatusDot } from "@/components/primitives/status-dot";

export const Route = createFileRoute("/_authenticated/app/settings/integrations")({
  component: Integrations,
});

const items = [
  { name: "YouTube", body: "Push exports as unlisted uploads." },
  { name: "Frame.io", body: "Sync review links with your team." },
  { name: "Google Drive", body: "Import footage from a shared folder." },
  { name: "Slack", body: "Notify a channel when a render completes." },
];

function Integrations() {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((i) => (
        <li key={i.name} className="rounded-2xl border border-line bg-surface-panel p-5">
          <div className="flex items-center justify-between">
            <div className="font-display text-base text-ink">{i.name}</div>
            <StatusDot variant="muted">Not connected</StatusDot>
          </div>
          <p className="mt-1 text-sm text-ink-soft">{i.body}</p>
          <button className="mt-3 rounded-md border border-line bg-surface-page px-3 py-1.5 text-sm text-ink">Connect</button>
        </li>
      ))}
    </ul>
  );
}