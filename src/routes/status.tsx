import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing/layout";
import { Section } from "@/components/primitives/section";
import { MarketingPageHero } from "@/components/marketing/page-shell";
import { WorkerEgressBadge } from "@/components/dashboard/WorkerEgressBadge";
import { pageMeta } from "@/config/seo";

export const Route = createFileRoute("/status")({
  head: () =>
    pageMeta({
      title: "Vidrial Source Access Status",
      description:
        "Check source acquisition health and understand what it means for your clipping job.",
      path: "/status",
      robots: "noindex,nofollow",
    }),
  component: StatusPage,
});

function StatusPage() {
  return (
    <MarketingLayout>
      <MarketingPageHero
        eyebrow="Status"
        title="Source access, at a glance."
        lead="A live check of the worker's source-access health. Your job page remains the source of truth for each import, preview and export."
      />
      <Section>
        <div className="mx-auto max-w-xl">
          <div className="rounded-2xl border border-line bg-surface-panel p-5 sm:p-7">
            <h2 className="text-lg font-semibold text-ink">Automatic source access</h2>
            <div className="mt-4">
              <WorkerEgressBadge />
            </div>
            <p className="mt-4 text-sm leading-6 text-ink-soft">
              A healthy probe does not guarantee access to every video. Provider rate limits,
              privacy, age and regional restrictions can affect an individual import. If a check
              cannot be completed, its status is unavailable—not proof of a network block.
            </p>
            <p className="mt-3 text-sm leading-6 text-ink-soft">
              This page does not monitor transcription, preview rendering or the export queue. Open
              your job for its actual progress and any recovery steps.
            </p>
            <Link
              to="/app/youtube-clipper"
              className="mt-5 inline-flex min-h-11 items-center font-semibold text-ember-ink underline underline-offset-4"
            >
              Open your clipping jobs
            </Link>
          </div>
        </div>
      </Section>
    </MarketingLayout>
  );
}
