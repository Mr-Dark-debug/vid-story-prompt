import { createFileRoute } from "@tanstack/react-router";
import { pageMeta } from "@/config/seo";

export const Route = createFileRoute("/docs/exporting")({
  head: () =>
    pageMeta({
      title: "Exporting Video from Vidrial — Documentation",
      description:
        "Choose video resolution, aspect ratio and caption settings, review usage, then monitor Vidrial's render and delivery states.",
      path: "/docs/exporting",
    }),
  component: () => (
    <article className="prose max-w-none text-ink-soft">
      <h1 className="font-display text-3xl text-ink">Exporting</h1>
      <p className="mt-2">
        Choose a preset (Master, YouTube 1080p, Reels 9:16, Audio-only), review estimated file size
        and usage, then queue it. Renders are visible from the exports tab of your project.
      </p>
    </article>
  ),
});
