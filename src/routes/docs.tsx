import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { MarketingLayout } from "@/components/marketing/layout";
import { Container } from "@/components/primitives/section";
import { cn } from "@/lib/utils";

interface HeadingItem {
  id: string;
  text: string;
  level: number;
}

const docsGroups = [
  {
    title: "Overview",
    items: [
      { to: "/docs", label: "Introduction" },
      { to: "/docs/getting-started", label: "Getting started" },
    ],
  },
  {
    title: "Guides & Concepts",
    items: [
      { to: "/docs/uploading-media", label: "Uploading media" },
      { to: "/docs/ai-editor", label: "The AI editor" },
      { to: "/docs/timeline", label: "Timeline basics" },
      { to: "/docs/exporting", label: "Exporting" },
    ],
  },
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
  const [headings, setHeadings] = useState<HeadingItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    const timer = setTimeout(() => {
      const container = document.querySelector("article");
      if (!container) {
        setHeadings([]);
        return;
      }

      const headingElements = container.querySelectorAll("h1, h2, h3");
      const items: HeadingItem[] = [];

      headingElements.forEach((el, index) => {
        const level = parseInt(el.tagName.substring(1), 10);
        if (!el.id) {
          el.id = el.textContent
            ? el.textContent
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/(^-|-$)/g, "")
            : `heading-${index}`;
        }
        items.push({
          id: el.id,
          text: el.textContent || "",
          level,
        });
      });

      setHeadings(items);
      if (items.length > 0) {
        setActiveId(items[0].id);
      }

      const observer = new IntersectionObserver(
        (entries) => {
          const visibleEntry = entries.find((entry) => entry.isIntersecting);
          if (visibleEntry) {
            setActiveId(visibleEntry.target.id);
          }
        },
        { rootMargin: "-85px 0px -75% 0px" }
      );

      headingElements.forEach((el) => observer.observe(el));

      return () => {
        observer.disconnect();
      };
    }, 150);

    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <MarketingLayout>
      <Container className="py-12 max-w-7xl">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start">
          {/* Left Column: Navigation Sidebar */}
          <aside className="w-full lg:w-[240px] lg:shrink-0 lg:sticky lg:top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2">
            <div className="text-[11px] font-bold uppercase tracking-widest text-ink-mute mb-5 px-3">
              Documentation
            </div>
            <nav className="space-y-6">
              {docsGroups.map((group) => (
                <div key={group.title} className="space-y-1.5">
                  <div className="text-xs font-semibold text-ink-mute/80 px-3 uppercase tracking-wider">
                    {group.title}
                  </div>
                  <div className="grid gap-0.5">
                    {group.items.map((item) => {
                      const active = pathname === item.to;
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          className={cn(
                            "group flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all",
                            active
                              ? "bg-surface-sunken text-ink font-semibold"
                              : "text-ink-soft hover:bg-surface-sunken/50 hover:text-ink"
                          )}
                        >
                          {active ? (
                            <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                          ) : (
                            <span className="h-1.5 w-1.5 rounded-full bg-transparent shrink-0 group-hover:bg-ink-mute/30 transition-all" />
                          )}
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </aside>

          {/* Middle Column: Document Content */}
          <div className="flex-1 min-w-0">
            {pathname === "/docs" ? <DocsIndex /> : <Outlet />}
          </div>

          {/* Right Column: Outline Table of Contents */}
          {headings.length > 1 && (
            <aside className="hidden xl:block xl:w-[220px] xl:shrink-0 xl:sticky xl:top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pl-4 border-l border-line/40">
              <div className="text-xs font-bold uppercase tracking-wider text-ink-mute mb-4 pl-3">
                On this page
              </div>
              <div className="relative border-l border-line/60 pl-px py-1">
                {headings.map((h) => {
                  const isActive = activeId === h.id;
                  return (
                    <a
                      key={h.id}
                      href={`#${h.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        document.getElementById(h.id)?.scrollIntoView({ behavior: "smooth" });
                        setActiveId(h.id);
                      }}
                      className={cn(
                        "block py-1.5 text-sm transition-all border-l-2 -ml-[2px] pr-2 break-words",
                        isActive
                          ? "border-primary text-ink font-medium"
                          : "border-transparent text-ink-soft/75 hover:text-ink"
                      )}
                      style={{
                        paddingLeft: `${h.level === 1 ? '1rem' : h.level === 2 ? '2rem' : '3rem'}`
                      }}
                    >
                      {h.text}
                    </a>
                  );
                })}
              </div>
            </aside>
          )}
        </div>
      </Container>
    </MarketingLayout>
  );
}

function DocsIndex() {
  const docsNav = docsGroups.flatMap((g) => g.items).filter((n) => n.to !== "/docs");
  return (
    <article className="prose max-w-none text-ink-soft">
      <h1 className="font-display text-3.5xl font-bold tracking-tight text-ink mb-6">Documentation</h1>
      <p className="mt-3">
        Start with <Link to="/docs/getting-started" className="text-ember-ink underline">Getting started</Link>, then dig into media, the AI editor, timeline and exporting.
      </p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {docsNav.map((n) => (
          <li key={n.to} className="rounded-xl border border-line bg-surface-panel p-5 hover:border-line-strong transition-colors duration-150">
            <Link to={n.to} className="text-sm font-semibold text-ink hover:underline">{n.label}</Link>
          </li>
        ))}
      </ul>
    </article>
  );
}
