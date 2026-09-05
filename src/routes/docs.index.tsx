import { createFileRoute, Link } from "@tanstack/react-router";

import { pageMeta } from "@/config/seo";

const docsNav = [
  { to: "/docs/getting-started", label: "Getting started" },
  { to: "/docs/uploading-media", label: "Uploading media" },
  { to: "/docs/exporting", label: "Exporting" },
] as const;

export const Route = createFileRoute("/docs/")({
  head: () =>
    pageMeta({
      title: "Vidrial Documentation — From Video to Clips",
      description:
        "Learn how to import authorised videos, create short clips, review captions and download finished exports.",
      path: "/docs",
    }),
  component: DocsIndex,
});

function DocsIndex() {
  return (
    <article className="prose max-w-none text-ink-soft">
      <h1 className="mb-6 font-display text-3.5xl font-bold tracking-tight text-ink">
        Documentation
      </h1>
      <p className="mt-3">
        Start with{" "}
        <Link to="/docs/getting-started" className="text-ember-ink underline">
          Getting started
        </Link>
        , then follow the guides for source uploads and clip exports.
      </p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {docsNav.map((item) => (
          <li
            key={item.to}
            className="rounded-xl border border-line bg-surface-panel p-5 transition-colors duration-150 hover:border-line-strong"
          >
            <Link to={item.to} className="text-sm font-semibold text-ink hover:underline">
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </article>
  );
}
