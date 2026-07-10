import { createFileRoute } from "@tanstack/react-router";
import { UseCaseTemplate } from "@/components/marketing/use-case-template";

export const Route = createFileRoute("/use-cases/youtube")({
  head: () => ({
    meta: [{ title: "For YouTube creators — Vidrial" }, { name: "description", content: "Turn hours of raw material into a tight first cut." }, { property: "og:url", content: "/use-cases/youtube" }],
    links: [{ rel: "canonical", href: "/use-cases/youtube" }],
  }),
  component: () => (
    <UseCaseTemplate
      eyebrow="YouTube"
      title="First cuts for YouTube — without the weekend."
      lead="Explainers, interviews and vlogs, tightened around the strongest takes."
      scenario={<>You filmed 90 minutes for a 10-minute explainer. Multiple takes of every section. A folder of B-roll you shot the day before.</>}
      prompts={[
        "10-minute first cut. Keep the strongest explanations. Remove pauses over 400 ms.",
        "Use exterior clips as B-roll during the introduction section.",
        "Add clean captions in a serif style and duck the music under my voice.",
      ]}
      outcomes={["A named version you can restore later", "A captioned 1080p master", "Two vertical clips drafted from the same source"]}
    />
  ),
});
