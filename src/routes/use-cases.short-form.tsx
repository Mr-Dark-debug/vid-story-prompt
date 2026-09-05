import { createFileRoute } from "@tanstack/react-router";
import { UseCaseTemplate } from "@/components/marketing/use-case-template";
import { pageMeta } from "@/config/seo";
export const Route = createFileRoute("/use-cases/short-form")({
  head: () =>
    pageMeta({
      title: "Short-form clips — Vidrial",
      description: "Create captioned clips for vertical feeds from authorised source video.",
      path: "/use-cases/short-form",
    }),
  component: () => (
    <UseCaseTemplate
      eyebrow="Short-form clips"
      title="One long video. More ways to share it."
      lead="Create captioned clips for vertical feeds from authorised source video."
      scenario="Your audience watches on a small screen. You need focused excerpts, not a shortened copy of the whole recording."
      prompts={[
        "Find a strong opening and preserve enough context to understand it.",
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
