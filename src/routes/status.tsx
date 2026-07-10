import { createFileRoute } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing/layout";
import { Section, SectionHeader } from "@/components/primitives/section";
import { MarketingPageHero } from "@/components/marketing/page-shell";
import { StatusDot } from "@/components/primitives/status-dot";

const services = [
  { name: "Web app", state: "operational" },
  { name: "Media analysis", state: "operational" },
  { name: "AI edit planner", state: "operational" },
  { name: "Export queue", state: "operational" },
];

export const Route = createFileRoute("/status")({
  head: () => ({
    meta: [
      { title: "Status — Vidrial" },
      { name: "description", content: "Live status of Vidrial services." },
      { property: "og:url", content: "/status" },
    ],
    links: [{ rel: "canonical", href: "/status" }],
  }),
  component: StatusPage,
});

function StatusPage() {
  return (
    <MarketingLayout>
      <MarketingPageHero eyebrow="Status" title="Everything looks fine." lead="This is a demonstration status page — no live probes are wired up in this build." />
      <Section>
        <div className="mx-auto max-w-xl">
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface-panel">
            {services.map((s) => (
              <li key={s.name} className="flex items-center justify-between px-5 py-4">
                <span className="text-sm text-ink">{s.name}</span>
                <StatusDot variant="success">Operational</StatusDot>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-ink-mute">
            Real status reporting will replace this static page. Incidents will be timestamped and archived.
          </p>
        </div>
      </Section>
    </MarketingLayout>
  );
}
