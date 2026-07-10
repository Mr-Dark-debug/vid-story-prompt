import { createFileRoute } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing/layout";
import { Container, Section, SectionHeader } from "@/components/primitives/section";
import { MarketingPageHero, FinalCTA } from "@/components/marketing/page-shell";
import { StatusDot } from "@/components/primitives/status-dot";

const features = [
  { t: "Project media intelligence", need: "You start with a folder, not a story.", does: "We transcribe, tag, group and search every clip so the AI has real context.", eg: "Search \"quiet room tone\" and find only the shots you need.", avail: "Available" },
  { t: "AI edit planning", need: "One prompt is never really one edit.", does: "Turn a sentence into a reviewable list of operations with a duration estimate.", eg: "Accept the pacing changes and reject the B-roll insert in one click.", avail: "Beta" },
  { t: "Transcript editing", need: "Cutting by waveform is a nightmare.", does: "Edit the words. The timeline follows. Or exclude words without touching text.", eg: "Highlight \"um\" markers and remove 143 in one action.", avail: "Available" },
  { t: "Timeline editing", need: "You still want the final call.", does: "Multi-track timeline with trim, split, ripple-delete, snap, zoom and undo.", eg: "Drag a clip 6 frames, ripple-close the gap, done.", avail: "Available" },
  { t: "Caption creation", need: "Every platform wants captions.", does: "Generate, style, position and export burned-in or sidecar subtitles.", eg: "Clean Editorial preset for YouTube, Bold Hook for Reels.", avail: "Beta" },
  { t: "Audio cleanup", need: "Room tone kills good takes.", does: "Dialogue enhancement, noise reduction, gain, ducking and loudness warnings.", eg: "Duck music -8 dB whenever someone speaks.", avail: "Beta" },
  { t: "B-roll search & placement", need: "\"Wait, where's that shot?\"", does: "Semantic search over your uploads and one-click placement onto the timeline.", eg: "\"exterior sunset with no people\" → 3 matches, ranked.", avail: "Available" },
  { t: "Aspect-ratio adaptation", need: "One shoot, four aspect ratios.", does: "Reframe with safe-area guides for 16:9, 9:16, 1:1 and 4:5.", eg: "Vertical version keeps the founder centred.", avail: "Beta" },
  { t: "Version history", need: "Undo isn't enough.", does: "Every meaningful AI action becomes a named, restorable version.", eg: "Compare v3 and v5 side-by-side.", avail: "Available" },
  { t: "Export management", need: "Renders shouldn't be a black box.", does: "Queued → preparing → rendering → uploading, with retry and share links.", eg: "Cancel a rogue 4K render before it finishes.", avail: "Beta" },
];

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "Features — Vidrial" },
      { name: "description", content: "The complete Vidrial workflow: understand, plan, edit, deliver." },
      { property: "og:title", content: "Features — Vidrial" },
      { property: "og:description", content: "Understand, plan, edit and deliver — grouped around real workflow." },
      { property: "og:url", content: "/features" },
    ],
    links: [{ rel: "canonical", href: "/features" }],
  }),
  component: FeaturesPage,
});

function FeaturesPage() {
  return (
    <MarketingLayout>
      <MarketingPageHero
        eyebrow="Features"
        title="A full editor, organised around the way you actually work."
        lead="No hundred-icon grid. Every feature earns its place in the workflow — and tells you honestly whether it's shipping today, in beta or planned."
      />
      <Section>
        <div className="grid gap-4 md:grid-cols-2">
          {features.map((f) => (
            <article
              key={f.t}
              className="rounded-2xl border border-line bg-surface-panel p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-lg text-ink">{f.t}</h3>
                <StatusDot variant={f.avail === "Available" ? "success" : f.avail === "Beta" ? "info" : "muted"}>
                  {f.avail}
                </StatusDot>
              </div>
              <dl className="mt-4 space-y-2 text-sm">
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-widest text-ink-mute">The problem</dt>
                  <dd className="text-ink-soft">{f.need}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-widest text-ink-mute">What Vidrial does</dt>
                  <dd className="text-ink">{f.does}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-widest text-ink-mute">Example</dt>
                  <dd className="text-ink-soft italic">{f.eg}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </Section>
      <FinalCTA headline="See the workflow end to end." body="Sign up to explore the seeded demo project." />
    </MarketingLayout>
  );
}