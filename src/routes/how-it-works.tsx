import { createFileRoute } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing/layout";
import { Section, SectionHeader } from "@/components/primitives/section";
import { MarketingPageHero, FinalCTA } from "@/components/marketing/page-shell";
import { Callout } from "@/components/primitives/section";

const steps = [
  { n: "01", t: "Upload or import media", d: "Video, audio, images, subtitles and reference text. Everything stays in your project." },
  { n: "02", t: "Previews & project metadata", d: "We generate proxies and a project index so the editor is responsive from the first minute." },
  { n: "03", t: "Speech, scenes & content analysis", d: "Transcription, speaker labels, scene cuts, quality checks and searchable tags." },
  { n: "04", t: "Your goal or instruction", d: "Fill out a short brief, or just describe what you want in plain language." },
  { n: "05", t: "Vidrial proposes a plan", d: "A structured list of operations with expected duration and usage estimates." },
  { n: "06", t: "Confirm or change it", d: "Accept all, accept some, edit any step, or reject the plan entirely." },
  { n: "07", t: "Non-destructive timeline", d: "Your originals are untouched. The timeline is a set of decisions you can rewind." },
  { n: "08", t: "Refine & export", d: "Adjust manually, generate captions, render aspect variants, share." },
];

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How Vidrial works" },
      { name: "description", content: "From raw footage to an editable timeline — the honest, step-by-step version." },
      { property: "og:title", content: "How Vidrial works" },
      { property: "og:url", content: "/how-it-works" },
    ],
    links: [{ rel: "canonical", href: "/how-it-works" }],
  }),
  component: HowItWorksPage,
});

function HowItWorksPage() {
  return (
    <MarketingLayout>
      <MarketingPageHero
        eyebrow="How it works"
        title="A first cut, without hand-waving."
        lead="No mystery pipeline. Here's exactly what happens between the upload button and the final export."
      />
      <Section>
        <div className="grid gap-3 md:grid-cols-2">
          {steps.map((s) => (
            <div key={s.n} className="rounded-2xl border border-line bg-surface-panel p-6">
              <div className="font-mono text-xs text-ember-ink">{s.n}</div>
              <div className="mt-2 font-display text-lg text-ink">{s.t}</div>
              <p className="mt-1 text-sm text-ink-soft">{s.d}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 max-w-3xl">
          <Callout title="Your originals are never modified" tone="info">
            The timeline is a sequence of decisions layered over your source files. Delete a project and the source records go with it. Projects are private by default.
          </Callout>
        </div>
      </Section>
      <FinalCTA headline="Ready to see it on your own footage?" />
    </MarketingLayout>
  );
}