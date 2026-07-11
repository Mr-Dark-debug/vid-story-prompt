import { createFileRoute } from "@tanstack/react-router";
import { Callout } from "@/components/primitives/section";
import { useState } from "react";
import { StatusDot } from "@/components/primitives/status-dot";

export const Route = createFileRoute("/_authenticated/app/settings/privacy")({
  component: Privacy,
});

function Privacy() {
  const [confirm, setConfirm] = useState<"none" | "project" | "account">("none");
  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-2xl border border-line bg-surface-panel p-6 text-sm text-ink">
        <div className="font-display text-lg">Retention</div>
        <p className="mt-1 text-ink-soft">Choose how long we keep uploaded media after your last edit.</p>
        <select className="mt-3 rounded-md border border-line bg-surface-page px-3 py-2 text-sm text-ink">
          <option>30 days</option><option>90 days</option><option>180 days</option><option>Until I delete it</option>
        </select>
      </div>
      <div className="rounded-2xl border border-line bg-surface-panel p-6 text-sm text-ink">
        <div className="font-display text-lg">Model training</div>
        <label className="mt-2 flex items-center gap-2 text-ink-soft">
          <input type="checkbox" className="h-4 w-4 accent-ember" />
          Allow anonymised transcripts to improve the AI editor. Off by default.
        </label>
      </div>
      <div className="rounded-2xl border border-line bg-surface-panel p-6 text-sm text-ink">
        <div className="font-display text-lg">Your data</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="rounded-md border border-line bg-surface-page px-3 py-2 text-sm text-ink">Download my data</button>
          <button onClick={() => setConfirm("project")} className="rounded-md border border-danger/50 bg-surface-page px-3 py-2 text-sm text-danger">Delete a project</button>
          <button onClick={() => setConfirm("account")} className="rounded-md border border-danger bg-danger/10 px-3 py-2 text-sm text-danger">Delete my account</button>
        </div>
        <StatusDot variant="demo">Actions are simulated</StatusDot>
      </div>
      {confirm !== "none" && (
        <Callout tone="danger" title={confirm === "account" ? "Delete account?" : "Delete project?"}>
          This can't be undone. <button onClick={() => setConfirm("none")} className="underline">Cancel</button>
        </Callout>
      )}
    </div>
  );
}