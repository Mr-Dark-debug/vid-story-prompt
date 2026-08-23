import { createFileRoute } from "@tanstack/react-router";
import { UseCaseTemplate } from "@/components/marketing/use-case-template";
import { pageMeta } from "@/config/seo";

export const Route = createFileRoute("/use-cases/short-form")({
  head: () =>
    pageMeta({
      title: "Long-Form to Short-Form Video Repurposing — Vidrial",
      description:
        "Find distinct hooks in long-form video and prepare editable vertical drafts with captions for Shorts, Reels and TikTok.",
      path: "/use-cases/short-form",
    }),
  component: () => (
    <UseCaseTemplate
      eyebrow="Short-form"
      title="Hook, hold, cut."
      lead="Find distinct hooks first, then use Beta aspect-ratio and caption tools to prepare vertical drafts."
      scenario={
        <>
          You have one long interview. You want three shortform pieces for Reels, Shorts and TikTok,
          each with a different opening.
        </>
      }
      prompts={[
        "Rank ten hooks by strength. Draft three 30-45s vertical clips with different openings.",
        "Add bold captions safe for 9:16 with a two-line maximum.",
      ]}
      outcomes={[
        "Three 9:16 drafts (Beta aspect-ratio adaptation)",
        "Hook-first structure",
        "Caption presets tuned for mobile (Beta)",
      ]}
    />
  ),
});
