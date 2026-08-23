import { createFileRoute } from "@tanstack/react-router";
import { pageMeta } from "@/config/seo";

export const Route = createFileRoute("/docs/timeline")({
  head: () =>
    pageMeta({
      title: "Video Timeline Editing Basics — Vidrial Documentation",
      description:
        "Learn Vidrial's core timeline controls for moving, trimming, splitting, ripple deleting and snapping video clips.",
      path: "/docs/timeline",
    }),
  component: () => (
    <article className="prose max-w-none text-ink-soft">
      <h1 className="font-display text-3xl text-ink">Timeline basics</h1>
      <p className="mt-2">
        Drag to move, edge-drag to trim, <kbd>S</kbd> to split at playhead, <kbd>Shift</kbd> +{" "}
        <kbd>Del</kbd> for ripple delete. Snapping is on by default; hold <kbd>Alt</kbd> to disable.
      </p>
    </article>
  ),
});
