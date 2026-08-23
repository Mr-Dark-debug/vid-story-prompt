import { createFileRoute } from "@tanstack/react-router";
import { pageMeta } from "@/config/seo";

export const Route = createFileRoute("/docs/ai-editor")({
  head: () =>
    pageMeta({
      title: "Using the Vidrial AI Video Editor — Documentation",
      description:
        "Write precise video-editing prompts, scope changes and review Vidrial's proposed operations before they reach the timeline.",
      path: "/docs/ai-editor",
    }),
  component: () => (
    <article className="prose max-w-none text-ink-soft">
      <h1 className="font-display text-3xl text-ink">The AI editor</h1>
      <p className="mt-2">
        Give it a goal, an audience and any constraints. It returns a plan you can trim, expand or
        throw out.
      </p>
      <h2 className="mt-6 font-display text-xl text-ink">Prompt patterns</h2>
      <ul className="mt-2 list-disc pl-5">
        <li>
          <em>Goal + duration + tone</em>: "A 6-minute first cut, calmer pacing, keep the pricing
          section."
        </li>
        <li>
          <em>Scoped fix</em>: "Only in the selected range, remove pauses over 500 ms."
        </li>
        <li>
          <em>Format switch</em>: "Draft a 9:16 version with a hook in the first 3 seconds."
        </li>
      </ul>
    </article>
  ),
});
