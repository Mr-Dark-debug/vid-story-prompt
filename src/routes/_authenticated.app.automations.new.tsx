import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, LockKeyhole } from "lucide-react";
import { AppPageHeader } from "@/components/app/layout";
import { AUTOMATION_TRIGGERS } from "@/domain/connectors/automation";

export const Route = createFileRoute("/_authenticated/app/automations/new")({
  component: NewAutomation,
});

function NewAutomation() {
  return (
    <div className="mx-auto max-w-4xl">
      <AppPageHeader
        eyebrow="Automation builder"
        title="Choose a source trigger"
        description="Only verified trigger implementations can be enabled. Planned workflows never create placeholder connections or jobs."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {AUTOMATION_TRIGGERS.map((trigger) => (
          <article
            key={trigger.id}
            className={`rounded-2xl border p-5 ${trigger.availability === "available" ? "border-ember bg-ember-soft/20" : "border-line bg-surface-panel"}`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-[.14em] text-ink-mute">
                {trigger.collectionLabel}
              </span>
              {trigger.availability !== "available" ? (
                <LockKeyhole className="h-4 w-4 text-ink-mute" />
              ) : null}
            </div>
            <h2 className="mt-3 font-display text-lg text-ink">{trigger.label}</h2>
            <p className="mt-2 text-xs leading-5 text-ink-mute">
              {trigger.availability === "available"
                ? "Configure this workflow through the connected YouTube channel settings."
                : "The adapter is catalogued, but polling/webhook execution is not yet marked available."}
            </p>
            {trigger.availability === "available" ? (
              <Link
                to="/app/settings/integrations"
                className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-ember-ink"
              >
                Configure YouTube <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : null}
          </article>
        ))}
      </div>
      <Link
        to="/app/automations"
        className="mt-6 inline-flex items-center gap-2 text-sm text-ink-soft"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to automations
      </Link>
    </div>
  );
}
