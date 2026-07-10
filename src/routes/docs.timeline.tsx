import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/docs/timeline")({
  head: () => ({
    meta: [{ title: "Timeline basics — Vidrial docs" }, { name: "description", content: "Multi-track editing, snapping and shortcuts." }, { property: "og:url", content: "/docs/timeline" }],
    links: [{ rel: "canonical", href: "/docs/timeline" }],
  }),
  component: () => (
    <article className="prose max-w-none text-ink-soft">
      <h1 className="font-display text-3xl text-ink">Timeline basics</h1>
      <p className="mt-2">Drag to move, edge-drag to trim, <kbd>S</kbd> to split at playhead, <kbd>Shift</kbd> + <kbd>Del</kbd> for ripple delete. Snapping is on by default; hold <kbd>Alt</kbd> to disable.</p>
    </article>
  ),
});
