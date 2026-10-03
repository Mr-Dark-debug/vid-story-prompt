import { createFileRoute } from "@tanstack/react-router";
import { ClippingInfoPage } from "@/components/marketing/clipping-info-page";
import { pageMeta } from "@/config/seo";
import { Link } from "@tanstack/react-router";
import { Section } from "@/components/primitives/section";
const sections = [
  {
    title: "Bring your source",
    body: "Upload an original video or submit an eligible YouTube URL. Connecting a YouTube account is optional and only enables browsing authorised channel content; it does not unlock downloads.",
  },
  {
    title: "Find complete moments",
    body: "Transcription and scene analysis help identify self-contained clips. Selection explanations let you judge context, not just a score.",
  },
  {
    title: "Choose the presentation",
    body: "Set clip length, aspect ratio and captions for Shorts, Reels and TikTok. Review clip-specific settings before exporting.",
  },
  {
    title: "Follow real progress",
    body: "See acquisition, analysis and rendering stages. Failures show actionable explanations; a queued job is not presented as a finished download.",
  },
  {
    title: "Download your clips",
    body: "Preview results and request exports within your plan's resolution and watermark limits. Downloads use time-limited links to private storage.",
  },
  {
    title: "Keep your workflow focused",
    body: "Vidrial is a clipping tool, not a general-purpose online editor. Take exported clips into your preferred editor when you need a longer production.",
  },
];
export const Route = createFileRoute("/features")({
  head: () =>
    pageMeta({
      title: "Video clipping features — Vidrial",
      description: "One focused workflow: import, find moments, review and export.",
      path: "/features",
    }),
  component: () => (
    <ClippingInfoPage
      title="Everything you need to go from long video to short clips."
      lead="One focused workflow: import, find moments, review and export."
      sections={sections}
    >
      <Section>
        <h2 className="text-2xl font-semibold text-ink">Create motion from a brief</h2>
        <p className="mt-3 max-w-2xl leading-relaxed text-ink-soft">
          Motion Studio adds a separate code-drawn animation workflow with original prompts, private
          versions and capability-gated rendering.
        </p>
        <Link
          to="/claude-motion-graphics"
          className="mt-4 inline-block min-h-11 py-3 text-ember-ink underline"
        >
          Explore Motion Studio
        </Link>
      </Section>
    </ClippingInfoPage>
  ),
});
