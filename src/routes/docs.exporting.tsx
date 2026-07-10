import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/docs/exporting")({
  head: () => ({
    meta: [{ title: "Exporting — Vidrial docs" }, { name: "description", content: "Resolutions, aspect ratios and captions." }, { property: "og:url", content: "/docs/exporting" }],
    links: [{ rel: "canonical", href: "/docs/exporting" }],
  }),
  component: () => (
    <article className="prose max-w-none text-ink-soft">
      <h1 className="font-display text-3xl text-ink">Exporting</h1>
      <p className="mt-2">Choose a preset (Master, YouTube 1080p, Reels 9:16, Audio-only), review estimated file size and usage, then queue it. Renders are visible from the exports tab of your project.</p>
    </article>
  ),
});
