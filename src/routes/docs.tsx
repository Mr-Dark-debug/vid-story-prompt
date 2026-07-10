import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing/layout";
import { Container } from "@/components/primitives/section";

const docsNav = [
  { to: "/docs", label: "Overview" },
  { to: "/docs/getting-started", label: "Getting started" },
  { to: "/docs/uploading-media", label: "Uploading media" },
  { to: "/docs/ai-editor", label: "The AI editor" },
  { to: "/docs/timeline", label: "Timeline basics" },
  { to: "/docs/exporting", label: "Exporting" },
];

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "Documentation — Vidrial" },
      { name: "description", content: "How to use Vidrial, end to end." },
      { property: "og:url", content: "/docs" },
    ],
    links: [{ rel: "canonical", href: "/docs" }],
  }),
  component: DocsLayout,
});

function DocsLayout() {
  const { pathname } = useLocation();
  return (
    <MarketingLayout>
      <Container className="py-12">
        <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
          <aside>
            <div className="text-[11px] font-semibold uppercase tracking-widest text-ink-mute">Documentation</div>
            <nav className="mt-3 grid gap-0.5">
              {docsNav.map((n) => {
                const active = pathname === n.to;
                return (
                  <Link
                    key={n.to}
                    to={n.to}
                    className={`rounded-md px-3 py-2 text-sm ${
                      active ? "bg-ember-soft text-ember-ink" : "text-ink-soft hover:bg-surface-sunken"
                    }`}
                  >
                    {n.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
          <div className="min-w-0">
            {pathname === "/docs" ? <DocsIndex /> : <Outlet />}
          </div>
        </div>
      </Container>
    </MarketingLayout>
  );
}

function DocsIndex() {
  return (
    <div className="prose max-w-none text-ink-soft">
      <h1 className="font-display text-3xl text-ink">Documentation</h1>
      <p className="mt-3">
        Start with <Link to="/docs/getting-started" className="text-ember-ink underline">Getting started</Link>, then dig into media, the AI editor, timeline and exporting.
      </p>
      <ul className="mt-6 grid gap-2 sm:grid-cols-2">
        {docsNav.slice(1).map((n) => (
          <li key={n.to} className="rounded-xl border border-line bg-surface-panel p-4">
            <Link to={n.to} className="text-ink hover:underline">{n.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
