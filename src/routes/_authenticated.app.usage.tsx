import { createFileRoute } from "@tanstack/react-router";
import { AppPageHeader } from "@/components/app/layout";
import { UsageMeter } from "@/components/primitives/usage-meter";
import { Callout } from "@/components/primitives/section";
import { getUsageOverview } from "@/services/usage/server";

export const Route = createFileRoute("/_authenticated/app/usage")({
  head: () => ({ meta: [{ title: "Usage — Vidrial" }] }),
  loader: () => getUsageOverview(),
  component: Usage,
});
function Usage() {
  const { period, ledger, storageBytes, exportCount, plan } = Route.useLoaderData();
  const sourceUsed = Math.ceil(
    (Number(period.source_seconds_committed) + Number(period.source_seconds_reserved)) / 60,
  );
  const sourceLimit = Math.ceil(Number(period.source_seconds_limit) / 60);
  const creditsUsed =
    Number(period.generation_credits_committed) + Number(period.generation_credits_reserved);
  const date = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });
  return (
    <div>
      <AppPageHeader
        title="Usage"
        eyebrow="Current billing period"
        description={`Live workspace usage for the ${plan} plan · ${date.format(new Date(period.period_start))}–${date.format(new Date(period.period_end))}`}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-5 rounded-2xl border border-line bg-surface-panel p-5">
          <UsageMeter label="Source minutes" used={sourceUsed} total={sourceLimit} unit="min" />
          {Number(period.generation_credits_limit) > 0 ? (
            <UsageMeter
              label="Generation credits"
              used={creditsUsed}
              total={Number(period.generation_credits_limit)}
              unit="credits"
              tone="teal"
            />
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <ActualMetric label="Rendered exports" value={String(exportCount)} />
            <ActualMetric
              label="Private storage"
              value={`${(storageBytes / 1024 / 1024 / 1024).toFixed(2)} GB`}
            />
          </div>
        </div>
        <div className="space-y-3">
          <Callout tone="info" title="Transactional usage">
            Source time is reserved when a job starts, committed after validation, and released when
            a job is safely cancelled.
          </Callout>
          <section className="rounded-2xl border border-line bg-surface-panel p-5">
            <h2 className="font-display text-base text-ink">Recent activity</h2>
            <ul className="mt-3 space-y-3">
              {ledger.map((entry) => (
                <li key={entry.id} className="flex items-start justify-between gap-3 text-sm">
                  <div>
                    <div className="text-ink">{entry.description}</div>
                    <time className="text-xs text-ink-mute" dateTime={entry.created_at}>
                      {date.format(new Date(entry.created_at))}
                    </time>
                  </div>
                  <span className="tabular-nums text-ink-soft">
                    {entry.amount} {entry.unit}
                  </span>
                </li>
              ))}
              {ledger.length === 0 && (
                <li className="text-sm text-ink-mute">No usage activity this period.</li>
              )}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function ActualMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-raised p-4">
      <div className="text-xs text-ink-mute">{label}</div>
      <div className="mt-1 font-display text-xl tabular-nums text-ink">{value}</div>
    </div>
  );
}
