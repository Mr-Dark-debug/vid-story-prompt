import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/docs/ai-editor")({
  head: () => ({
    meta: [{ title: "The AI editor — Vidrial docs" }, { name: "description", content: "How to write good prompts and review plans." }, { property: "og:url", content: "/docs/ai-editor" }],
    links: [{ rel: "canonical", href: "/docs/ai-editor" }],
  }),
  component: () => (
    <article className="prose max-w-none text-ink-soft">
      <h1 className="font-display text-3xl text-ink">The AI editor</h1>
      <p className="mt-2">Give it a goal, an audience and any constraints. It returns a plan you can trim, expand or throw out.</p>
      <h2 className="mt-6 font-display text-xl text-ink">Prompt patterns</h2>
      <ul className="mt-2 list-disc pl-5">
        <li><em>Goal + duration + tone</em>: "A 6-minute first cut, calmer pacing, keep the pricing section."</li>
        <li><em>Scoped fix</em>: "Only in the selected range, remove pauses over 500 ms."</li>
        <li><em>Format switch</em>: "Draft a 9:16 version with a hook in the first 3 seconds."</li>
      </ul>
    </article>
  ),
});
