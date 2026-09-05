import { createFileRoute } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing/layout";
import { Section } from "@/components/primitives/section";
import { MarketingPageHero } from "@/components/marketing/page-shell";
import { pageMeta } from "@/config/seo";

const entries = [
  {
    date: "2026-09-05",
    title: "A clipping-only product",
    body: "Vidrial now focuses on authorised video imports, short-clip selection, captions and exports. Standalone editor pages and project templates have been retired; saved media has not been deleted.",
  },
];

export const Route = createFileRoute("/changelog")({
  head: () =>
    pageMeta({
      title: "Vidrial Changelog — Video Clipping Updates",
      description:
        "Track changes to Vidrial's clipping workflow, source acquisition, clip review and exports.",
      path: "/changelog",
    }),
  component: ChangelogPage,
});

function ChangelogPage() {
  return (
    <MarketingLayout>
      <MarketingPageHero eyebrow="Changelog" title="Meaningful changes, plainly written." />
      <Section>
        <ol className="mx-auto max-w-3xl space-y-6">
          {entries.map((e) => (
            <li key={e.date} className="rounded-2xl border border-line bg-surface-panel p-6">
              <time className="font-mono text-xs text-ember-ink">{e.date}</time>
              <h2 className="mt-2 font-display text-xl text-ink">{e.title}</h2>
              <p className="mt-1.5 text-sm text-ink-soft">{e.body}</p>
            </li>
          ))}
        </ol>
      </Section>
    </MarketingLayout>
  );
}
