import { createFileRoute } from "@tanstack/react-router";
import { UseCaseTemplate } from "@/components/marketing/use-case-template";
import { pageMeta } from "@/config/seo";
export const Route = createFileRoute("/use-cases/podcasts")({
  head: () =>
    pageMeta({
      title: "Podcast clips — Vidrial",
      description:
        "Turn your video podcast into short, captioned moments without losing the point.",
      path: "/use-cases/podcasts",
    }),
  component: () => (
    <UseCaseTemplate
      eyebrow="Podcast clips"
      title="Let a great conversation travel further."
      lead="Turn your video podcast into short, captioned moments without losing the point."
      scenario="You recorded a long conversation and want to share the most useful answers."
      prompts={[
        "Choose moments with a clear question and a complete answer.",
        "Keep the clip understandable without watching the full source.",
        "Avoid excerpts that change the speaker's intended meaning.",
      ]}
      outcomes={[
        "Short clip candidates with selection explanations",
        "Captioned previews to review",
        "Exports within your plan's quality limits",
      ]}
    />
  ),
});
