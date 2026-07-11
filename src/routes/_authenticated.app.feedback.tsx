import { createFileRoute } from "@tanstack/react-router";
import { AppPageHeader } from "@/components/app/layout";
import { StatusDot } from "@/components/primitives/status-dot";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/app/feedback")({
  head: () => ({ meta: [{ title: "Feedback — Vidrial" }] }),
  component: Feedback,
});

function Feedback() {
  const [sent, setSent] = useState(false);
  return (
    <div>
      <AppPageHeader title="Feedback" eyebrow="Tell us what to build" />
      {sent ? (
        <div className="rounded-2xl border border-line bg-surface-panel p-6 text-center">
          <div className="font-display text-lg text-ink">Thanks — noted.</div>
          <p className="mt-2 text-sm text-ink-soft">Your note is stored locally in this preview.</p>
          <StatusDot variant="demo">Not sent to a server</StatusDot>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); setSent(true); }} className="max-w-xl space-y-3 rounded-2xl border border-line bg-surface-panel p-6">
          <label className="block text-sm text-ink">What are we missing?
            <textarea required rows={5} className="mt-1 w-full rounded-md border border-line bg-surface-page p-3 text-sm text-ink outline-none focus:border-ember" />
          </label>
          <button className="rounded-md bg-ink px-3 py-2 text-sm font-medium text-surface-page">Send</button>
        </form>
      )}
    </div>
  );
}