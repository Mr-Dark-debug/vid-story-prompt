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
    title: "Motion Studio models and examples",
    body: "When enabled, Motion Studio sends your brief, exact text and prior scene code to the selected configured model. The current platform adapter uses OpenRouter. The model writes HTML; an isolated browser draws frames and FFmpeg encodes them. Official examples are original authored scenes, not claimed outputs of a named model. Reference frames are sent only when rights-attested vision analysis is enabled.",
  },
  {
    title: "Your own AI key",
    body: "If you connect your own provider key, chat messages and, for sources you choose to process with it, transcript text and clip details go to that provider using your key, under their terms. You choose the model per feature or per job. If your provider rejects the key, Vidrial says so and uses its built-in selection instead; it never silently pretends your model was used.",
  },
  {
    title: "What Vidrial does not promise",
    body: "AI assistance does not guarantee factual accuracy, animation quality or audience response. A model name in a prompt collection does not mean it is configured for generation. Your export remains your publishing decision.",
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
