import { createFileRoute } from "@tanstack/react-router";
import { UseCaseTemplate } from "@/components/marketing/use-case-template";
import { pageMeta } from "@/config/seo";
export const Route = createFileRoute("/use-cases/youtube")({
  head: () =>
    pageMeta({
      title: "YouTube clips — Vidrial",
      description: "Find self-contained explanations and highlights in videos you own.",
      path: "/use-cases/youtube",
    }),
  component: () => (
    <UseCaseTemplate
      eyebrow="YouTube clips"
      title="Give your long videos a second audience."
      lead="Find self-contained explanations and highlights in videos you own."
      scenario="You have a published interview or explainer and want short excerpts for Shorts, Reels and TikTok."
      prompts={[
        "Find complete answers that stand on their own.",
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
