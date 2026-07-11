import { createFileRoute } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing/layout";
import { Section, SectionHeader, Callout } from "@/components/primitives/section";
import { StatusDot } from "@/components/primitives/status-dot";
import { UsageMeter } from "@/components/primitives/usage-meter";

export const Route = createFileRoute("/design-system")({
  head: () => ({ meta: [{ title: "Design system — Vidrial" }] }),
  component: DS,
});

const tokens = [
  ["--surface-page", "bg-surface-page"],
  ["--surface-panel", "bg-surface-panel"],
  ["--surface-sunken", "bg-surface-sunken"],
  ["--ink", "bg-ink"],
  ["--ember", "bg-ember"],
  ["--ember-soft", "bg-ember-soft"],
  ["--teal", "bg-teal"],
];

function DS() {
  return (
    <MarketingLayout>
      <Section>
        <SectionHeader eyebrow="Internal" title="Vidrial design system" lead="Tokens, primitives and states used across the product." />
        <h3 className="mb-3 font-display text-xl text-ink">Colour</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tokens.map(([n, cls]) => (
            <div key={n} className="overflow-hidden rounded-xl border border-line">
              <div className={`${cls} h-16`} />
              <div className="px-3 py-2 text-[11px] text-ink-mute">{n}</div>
            </div>
          ))}
        </div>
        <h3 className="mb-3 mt-10 font-display text-xl text-ink">Typography</h3>
        <div className="space-y-2 rounded-2xl border border-line bg-surface-panel p-6">
          <div className="font-display text-4xl text-ink">Display · Fraunces</div>
          <div className="text-lg text-ink">Body · Inter</div>
          <div className="font-mono text-sm text-ink-soft">Mono · JetBrains</div>
        </div>
        <h3 className="mb-3 mt-10 font-display text-xl text-ink">Status</h3>
        <div className="flex flex-wrap gap-2">
          <StatusDot variant="success">success</StatusDot>
          <StatusDot variant="info">info</StatusDot>
          <StatusDot variant="warning">warning</StatusDot>
          <StatusDot variant="danger">danger</StatusDot>
          <StatusDot variant="demo">demo</StatusDot>
          <StatusDot variant="muted">muted</StatusDot>
        </div>
        <h3 className="mb-3 mt-10 font-display text-xl text-ink">Meters & callouts</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-4 rounded-2xl border border-line bg-surface-panel p-5">
            <UsageMeter label="Source minutes" used={214} total={600} unit="min" />
            <UsageMeter label="AI operations" used={128} total={500} unit="ops" tone="teal" />
          </div>
          <div className="space-y-3">
            <Callout tone="info" title="Info">Contextual help.</Callout>
            <Callout tone="warning" title="Warning">Watch out.</Callout>
            <Callout tone="danger" title="Danger">Destructive action.</Callout>
          </div>
        </div>
      </Section>
    </MarketingLayout>
  );
}