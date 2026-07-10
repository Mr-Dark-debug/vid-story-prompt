import { createFileRoute } from "@tanstack/react-router";
import { UseCaseTemplate } from "@/components/marketing/use-case-template";

export const Route = createFileRoute("/use-cases/short-form")({
  head: () => ({
    meta: [{ title: "For short-form — Vidrial" }, { name: "description", content: "Long-form into vertical hooks, fast." }, { property: "og:url", content: "/use-cases/short-form" }],
    links: [{ rel: "canonical", href: "/use-cases/short-form" }],
  }),
  component: () => (
    <UseCaseTemplate
      eyebrow="Short-form"
      title="Hook, hold, cut."
      lead="Draft three vertical clips from the same source, each with a distinct hook."
      scenario={<>You have one long interview. You want three shortform pieces for Reels, Shorts and TikTok, each with a different opening.</>}
      prompts={[
        "Rank ten hooks by strength. Draft three 30-45s vertical clips with different openings.",
        "Add bold captions safe for 9:16 with a two-line maximum.",
      ]}
      outcomes={["Three 9:16 drafts", "Hook-first structure", "Caption presets tuned for mobile"]}
    />
  ),
});
