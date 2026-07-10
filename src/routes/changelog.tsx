import { createFileRoute } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing/layout";
import { Section } from "@/components/primitives/section";
import { MarketingPageHero } from "@/components/marketing/page-shell";

const entries = [
  { date: "2026-07-01", title: "AI edit-plan review", body: "Every AI action now surfaces as a reviewable plan with per-operation accept/reject and duration estimates." },
  { date: "2026-06-14", title: "Semantic media search", body: "Ask for footage in plain language — \"quiet room tone\", \"exterior at sunset\" — and the library ranks matches." },
  { date: "2026-05-30", title: "Timeline prototype", body: "Multi-track timeline with trim, split, ripple-delete, snap and 500-step undo." },
  { date: "2026-05-10", title: "Private beta opens", body: "First outside creators start using Vidrial. Feedback: keep the AI's work reviewable." },
];

export const Route = createFileRoute("/changelog")({
  head: () => ({
    meta: [
      { title: "Changelog — Vidrial" },
      { name: "description", content: "Meaningful changes to Vidrial, in reverse chronological order." },
      { property: "og:url", content: "/changelog" },
    ],
    links: [{ rel: "canonical", href: "/changelog" }],
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
