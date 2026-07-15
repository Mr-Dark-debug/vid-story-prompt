import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Bot, Check, Clock3 } from "lucide-react";
import { AppPageHeader } from "@/components/app/layout";
import { AUTOMATION_TRIGGERS } from "@/domain/connectors/automation";
import { getYouTubeConnection } from "@/services/youtube/oauth.server";

export const Route = createFileRoute("/_authenticated/app/automations/")({
  loader: () => getYouTubeConnection(),
  component: AutomationsIndex,
});

function AutomationsIndex() {
  const connection = Route.useLoaderData();
  const rules = connection?.rules ?? [];
  return (
    <div>
      <AppPageHeader
        eyebrow="Connected workflows"
        title="Automations"
        description="Turn authorised source events into reviewable clipping jobs without processing the same remote asset twice."
        actions={
          <Link
            to="/app/automations/new"
            className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-surface-page"
          >
            New automation <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />
      <section className="rounded-3xl border border-line bg-surface-panel p-5 sm:p-7">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-ember-ink" />
          <h2 className="font-display text-xl text-ink">Your rules</h2>
        </div>
        {rules.length ? (
          <div className="mt-5 space-y-3">
            {rules.map((rule) => (
              <article
                key={rule.id}
                className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface-raised p-4"
              >
                <span
                  className={`grid h-10 w-10 place-items-center rounded-xl ${rule.enabled ? "bg-success/10 text-success" : "bg-surface-sunken text-ink-mute"}`}
                >
                  {rule.enabled ? <Check className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-ink">Clip new YouTube uploads</h3>
                  <p className="mt-1 text-xs text-ink-mute">
                    {rule.requested_clip_count} clips ·{" "}
                    {rule.source_behavior === "create_draft"
                      ? "Original source requested before processing"
                      : "Starts only when an authorised source mapping exists"}
                  </p>
                </div>
                <Link
                  to="/app/settings/integrations"
                  className="text-xs font-semibold text-ember-ink"
                >
                  Manage
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-line px-5 py-8 text-center">
            <p className="text-sm font-medium text-ink">No automation rules yet</p>
            <p className="mt-1 text-xs text-ink-mute">
              YouTube channel automation is available after an official channel connection.
            </p>
          </div>
        )}
      </section>
      <section className="mt-6">
        <h2 className="text-sm font-semibold text-ink">Workflow directory</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {AUTOMATION_TRIGGERS.map((trigger) => (
            <article
              key={trigger.id}
              className="rounded-2xl border border-line bg-surface-panel p-4"
            >
              <span className="text-[10px] font-semibold uppercase tracking-[.12em] text-ink-mute">
                {trigger.availability === "available" ? "Available" : "Coming soon"}
              </span>
              <h3 className="mt-2 text-sm font-semibold text-ink">{trigger.label}</h3>
              <p className="mt-1 text-xs text-ink-mute">{trigger.collectionLabel}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
