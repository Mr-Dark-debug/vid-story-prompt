import { createFileRoute } from "@tanstack/react-router";
import { UseCaseTemplate } from "@/components/marketing/use-case-template";
import { pageMeta } from "@/config/seo";
export const Route = createFileRoute("/use-cases/courses")({
  head: () =>
    pageMeta({
      title: "Course clips — Vidrial",
      description: "Extract short learning moments from your own courses and webinars.",
      path: "/use-cases/courses",
    }),
  component: () => (
    <UseCaseTemplate
      eyebrow="Course clips"
      title="Make one useful lesson easy to share."
      lead="Extract short learning moments from your own courses and webinars."
      scenario="You want a concise example or lesson preview from a longer recording."
      prompts={[
        "Select one concept with its explanation and practical example.",
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
