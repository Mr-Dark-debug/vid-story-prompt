import { createFileRoute } from "@tanstack/react-router";
import { UseCaseTemplate } from "@/components/marketing/use-case-template";
import { pageMeta } from "@/config/seo";
export const Route = createFileRoute("/use-cases/product-demos")({
  head: () =>
    pageMeta({
      title: "Product demo clips — Vidrial",
      description: "Create short walkthrough excerpts from your recorded product demonstrations.",
      path: "/use-cases/product-demos",
    }),
  component: () => (
    <UseCaseTemplate
      eyebrow="Product demo clips"
      title="Show one useful feature at a time."
      lead="Create short walkthrough excerpts from your recorded product demonstrations."
      scenario="You have a long demo and want a focused excerpt for a customer question or product update."
      prompts={[
        "Find a complete demonstration of one feature without cutting off the outcome.",
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
