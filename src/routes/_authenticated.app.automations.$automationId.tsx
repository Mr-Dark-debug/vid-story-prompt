import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { AppPageHeader } from "@/components/app/layout";

export const Route = createFileRoute("/_authenticated/app/automations/$automationId")({
  params: { parse: (params) => ({ automationId: z.string().uuid().parse(params.automationId) }) },
  component: AutomationDetail,
});

function AutomationDetail() {
  return (
    <div>
      <AppPageHeader
        eyebrow="Automation"
        title="Rule details"
        description="Rule execution, source deduplication, usage ceilings, and provider health are enforced server-side."
      />
      <div className="rounded-3xl border border-line bg-surface-panel p-6">
        <p className="text-sm text-ink-soft">
          This rule is managed from its connected source settings.
        </p>
        <Link
          to="/app/settings/integrations"
          className="mt-4 inline-flex text-sm font-semibold text-ember-ink"
        >
          Open integration settings
        </Link>
      </div>
    </div>
  );
}
