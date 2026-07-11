import { createFileRoute } from "@tanstack/react-router";
import { AppPageHeader } from "@/components/app/layout";
import { Callout } from "@/components/primitives/section";
import { StatusDot } from "@/components/primitives/status-dot";

export const Route = createFileRoute("/_authenticated/app/billing")({
  head: () => ({ meta: [{ title: "Billing — Vidrial" }] }),
  component: Billing,
});

function Billing() {
  return (
    <div>
      <AppPageHeader title="Billing" eyebrow="Plan & payments" description="The paid plan is on a waitlist during private preview." />
      <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border border-line bg-surface-panel p-6">
          <div className="flex items-center justify-between">
            <div className="font-display text-lg text-ink">Free · Preview</div>
            <StatusDot variant="info">active</StatusDot>
          </div>
          <p className="mt-2 text-sm text-ink-soft">3 projects · 60 source minutes / month · watermarked exports.</p>
          <button className="mt-5 rounded-md bg-ink px-3 py-2 text-sm font-medium text-surface-page">Join paid-plan waitlist</button>
          <p className="mt-2 text-[11px] text-ink-mute">No card required.</p>
        </div>
        <Callout tone="warning" title="No checkout in preview">
          Vidrial won't ask for a card and we don't process real charges here.
        </Callout>
      </div>
    </div>
  );
}