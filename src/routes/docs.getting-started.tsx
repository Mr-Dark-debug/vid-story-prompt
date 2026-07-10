import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/docs/getting-started")({
  head: () => ({
    meta: [{ title: "Getting started — Vidrial docs" }, { name: "description", content: "Your first Vidrial project." }, { property: "og:url", content: "/docs/getting-started" }],
    links: [{ rel: "canonical", href: "/docs/getting-started" }],
  }),
  component: () => (
    <article className="prose max-w-none text-ink-soft">
      <h1 className="font-display text-3xl text-ink">Getting started</h1>
      <p className="mt-2">Create an account, land in the dashboard, and open the seeded demo project — no upload required.</p>
      <ol className="mt-4 space-y-2 list-decimal pl-5">
        <li>Sign up. The onboarding flow asks about your typical content and length.</li>
        <li>Open the "Autumn Roastery Launch" demo project.</li>
        <li>Try the AI editor with an included prompt.</li>
        <li>Accept or reject each proposed operation.</li>
        <li>Export a 720p preview to see the delivery flow.</li>
      </ol>
    </article>
  ),
});
