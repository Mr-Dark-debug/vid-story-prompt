import { createFileRoute, Link } from "@tanstack/react-router";
import { AppPageHeader } from "@/components/app/layout";

export const Route = createFileRoute("/_authenticated/app/help")({
  head: () => ({ meta: [{ title: "Help — Vidrial" }] }),
  component: Help,
});

const links = [
  { to: "/docs/getting-started", label: "Getting started" },
  { to: "/docs/uploading-media", label: "Uploading media" },
  { to: "/docs/ai-editor", label: "Using the AI editor" },
  { to: "/docs/timeline", label: "The timeline" },
  { to: "/docs/exporting", label: "Exporting" },
  { to: "/contact", label: "Contact support" },
] as const;

function Help() {
  return (
    <div>
      <AppPageHeader title="Help & docs" description="Short, honest guides." />
      <ul className="grid gap-3 sm:grid-cols-2">
        {links.map((l) => (
          <li key={l.to}>
            <Link to={l.to} className="block rounded-xl border border-line bg-surface-panel p-4 text-ink hover:border-line-strong">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}