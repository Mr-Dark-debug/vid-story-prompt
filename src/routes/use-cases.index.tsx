import { createFileRoute, Link } from "@tanstack/react-router";
import { Youtube, Mic, Smartphone, GraduationCap, MonitorPlay, ArrowRight } from "lucide-react";
import { MarketingLayout } from "@/components/marketing/layout";
import { Section } from "@/components/primitives/section";
import { MarketingPageHero } from "@/components/marketing/page-shell";

const cases = [
  { to: "/use-cases/youtube", i: Youtube, t: "YouTube videos", d: "Tighten explainers and interviews without losing your voice." },
  { to: "/use-cases/podcasts", i: Mic, t: "Video podcasts", d: "Cut the room silence, keep the conversation." },
  { to: "/use-cases/short-form", i: Smartphone, t: "Short-form clips", d: "Turn long-form into vertical hooks fast." },
  { to: "/use-cases/courses", i: GraduationCap, t: "Online lessons", d: "Structured lessons with captions and chapters." },
  { to: "/use-cases/product-demos", i: MonitorPlay, t: "Product demos", d: "Screen and camera into a clear, tight demo." },
];

export const Route = createFileRoute("/use-cases/")({
  head: () => ({
    meta: [
      { title: "Use cases — Vidrial" },
      { name: "description", content: "Vidrial for YouTube, podcasts, short-form, courses and product demos." },
      { property: "og:url", content: "/use-cases" },
    ],
    links: [{ rel: "canonical", href: "/use-cases" }],
  }),
  component: () => (
    <MarketingLayout>
      <MarketingPageHero eyebrow="Use cases" title="Built for the way people make video." lead="Same product, five distinct workflows." />
      <Section>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cases.map((c) => (
            <Link key={c.to} to={c.to} className="group rounded-2xl border border-line bg-surface-panel p-6 hover:border-line-strong">
              <c.i className="h-6 w-6 text-ember" />
              <div className="mt-4 font-display text-xl text-ink">{c.t}</div>
              <p className="mt-1 text-sm text-ink-soft">{c.d}</p>
              <div className="mt-4 inline-flex items-center gap-1 text-sm text-ink-mute group-hover:text-ink">
                Explore <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </Link>
          ))}
        </div>
      </Section>
    </MarketingLayout>
  ),
});