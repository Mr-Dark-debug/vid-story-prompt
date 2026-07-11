import { createFileRoute } from "@tanstack/react-router";
import { AppPageHeader } from "@/components/app/layout";
import { UsageMeter } from "@/components/primitives/usage-meter";
import { Callout } from "@/components/primitives/section";

export const Route = createFileRoute("/_authenticated/app/usage")({
  head: () => ({ meta: [{ title: "Usage — Vidrial" }] }),
  component: Usage,
});

function Usage() {
  return (
    <div>
      <AppPageHeader title="Usage" eyebrow="This billing period" description="Editing is measured in source minutes. Generated media uses separate credits." />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-5 rounded-2xl border border-line bg-surface-panel p-5">
          <UsageMeter label="Source minutes" used={214} total={600} unit="min" />
          <UsageMeter label="AI operations" used={128} total={500} unit="ops" tone="teal" />
          <UsageMeter label="Renders" used={11} total={40} unit="jobs" tone="info" />
          <UsageMeter label="Storage" used={18} total={50} unit="GB" tone="ember" />
        </div>
        <div className="space-y-3">
          <Callout tone="info" title="You'll see the cost before an expensive edit">
            Any AI plan that would spend more than 10 source minutes shows an estimate first.
          </Callout>
          <div className="rounded-2xl border border-line bg-surface-panel p-5 text-sm text-ink-soft">
            <div className="font-display text-base text-ink">Recent activity</div>
            <ul className="mt-3 space-y-2">
              <li className="flex justify-between"><span>AI first cut · Autumn Roastery</span><span>32 min</span></li>
              <li className="flex justify-between"><span>Caption pass · Autumn Roastery</span><span>18 min</span></li>
              <li className="flex justify-between"><span>Export · YouTube 1080p</span><span>1 render</span></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}