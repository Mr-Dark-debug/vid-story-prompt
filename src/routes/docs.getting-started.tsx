import { createFileRoute } from "@tanstack/react-router";
import { pageMeta } from "@/config/seo";

export const Route = createFileRoute("/docs/getting-started")({
  head: () =>
    pageMeta({
      title: "Getting Started with Vidrial — Documentation",
      description:
        "Create your first Vidrial project, review an AI-assisted edit plan and export a controlled preview from authorised media.",
      path: "/docs/getting-started",
    }),
  component: () => (
    <article className="prose max-w-none text-ink-soft">
      <h1 className="font-display text-3xl text-ink">Getting started</h1>
      <p className="mt-2">
        Create an account, open your empty workspace, then create a project or start a clipping job
        with authorised media.
      </p>
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
