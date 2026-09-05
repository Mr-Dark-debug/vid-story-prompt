import { createFileRoute } from "@tanstack/react-router";
import { ClippingInfoPage } from "@/components/marketing/clipping-info-page";
import { pageMeta } from "@/config/seo";
const sections = [
  {
    title: "What uses AI",
    body: "Speech transcription and clip planning use configured providers. Clip scores and explanations are suggestions, not guarantees of audience response.",
  },
  {
    title: "What providers receive",
    body: "Audio is sent to the configured transcription provider; relevant transcripts and selection instructions are used for planning. Do not submit media you are not authorised to process.",
  },
  {
    title: "What you should review",
    body: "Check transcripts, captions, context and framing before sharing. Automated transcription can make mistakes, especially with quiet, noisy or multilingual audio.",
  },
  {
    title: "What Vidrial does not promise",
    body: "There is no general-purpose timeline editor, synthetic-video generator or automatic claim of factual accuracy. Your export remains your publishing decision.",
  },
];
export const Route = createFileRoute("/ai-transparency")({
  head: () =>
    pageMeta({
      title: "AI transparency — Vidrial",
      description:
        "Vidrial uses AI to assist clipping, not to guarantee accuracy or predict virality.",
      path: "/ai-transparency",
    }),
  component: () => (
    <ClippingInfoPage
      title="AI selects moments. You decide what to share."
      lead="Vidrial uses AI to assist clipping, not to guarantee accuracy or predict virality."
      sections={sections}
    />
  ),
});
