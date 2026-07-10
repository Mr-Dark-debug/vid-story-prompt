import { createFileRoute } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing/layout";
import { Section, SectionHeader } from "@/components/primitives/section";
import { MarketingPageHero, FinalCTA } from "@/components/marketing/page-shell";
import { StatusDot } from "@/components/primitives/status-dot";

const columns = [
  {
    title: "Now",
    items: [
      "Project analysis (transcription, tags, scenes)",
      "AI edit-plan review",
      "Multi-track timeline prototype",
      "Caption presets",
    ],
  },
  {
    title: "Next",
    items: [
      "Aspect-ratio adaptation with safe areas",
      "Multicam alignment",
      "Translation and dubbing",
      "Team workspaces",
    ],
  },
  {
    title: "Later",
    items: [
      "XML export for pro NLEs",
      "Brand kits with per-project variants",
      "Collaborator comments on the timeline",
      "Public template gallery",
    ],
  },
];

export const Route = createFileRoute("/roadmap")({
  head: () => ({
    meta: [
      { title: "Roadmap — Vidrial" },
      { name: "description", content: "What we're building, what's next, and what's later." },
      { property: "og:url", content: "/roadmap" },
    ],
    links: [{ rel: "canonical", href: "/roadmap" }],
  }),
  component: RoadmapPage,
});

function RoadmapPage() {
  return (
    <MarketingLayout>
      <MarketingPageHero eyebrow="Roadmap" title="Where Vidrial is going." lead="Nothing here is a promise. It's a working plan, updated as we ship." />
      <Section>
        <div className="grid gap-4 md:grid-cols-3">
          {columns.map((c) => (
            <div key={c.title} className="rounded-2xl border border-line bg-surface-panel p-6">
              <div className="flex items-center justify-between">
                <div className="font-display text-lg text-ink">{c.title}</div>
                <StatusDot variant={c.title === "Now" ? "success" : c.title === "Next" ? "info" : "muted"}>
                  {c.title}
                </StatusDot>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-ink-soft">
                {c.items.map((i) => (
                  <li key={i} className="rounded-lg border border-line bg-surface-page px-3 py-2">
                    {i}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>
      <FinalCTA headline="Want to shape what's next?" body="Send us what's slowing your edits down." to="/contact" actionLabel="Contact us" />
    </MarketingLayout>
  );
}
