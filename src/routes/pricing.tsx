import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, HelpCircle } from "lucide-react";
import { MarketingLayout } from "@/components/marketing/layout";
import { Container, Section, SectionHeader } from "@/components/primitives/section";
import { MarketingPageHero, FinalCTA } from "@/components/marketing/page-shell";
import { StatusDot } from "@/components/primitives/status-dot";
import { Callout } from "@/components/primitives/section";

const plans = [
  {
    name: "Free",
    monthly: 0,
    annual: 0,
    tag: "Try it end to end",
    features: [
      "3 active projects",
      "60 source minutes / month",
      "2 GB storage",
      "720p exports",
      "Watermarked exports",
      "1 watermark-free trial export",
      "Core transcription & cleanup",
    ],
    cta: "Create a free account",
  },
  {
    name: "Creator",
    monthly: 18,
    annual: 15,
    tag: "Recommended",
    featured: true,
    features: [
      "600 source minutes / month",
      "50 GB storage",
      "1080p exports",
      "No watermark",
      "AI edit plans",
      "Captions",
      "Uploaded B-roll",
      "Version history",
      "Commercial use",
    ],
    cta: "Join Creator waitlist",
  },
  {
    name: "Pro",
    monthly: 39,
    annual: 32,
    tag: "For heavy weeks",
    features: [
      "1,800 source minutes / month",
      "250 GB storage",
      "4K exports",
      "Multicam (planned)",
      "Brand kits",
      "Translation (planned)",
      "Advanced audio",
      "XML export (planned)",
      "Priority processing",
    ],
    cta: "Join Pro waitlist",
  },
];

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Vidrial" },
      { name: "description", content: "Simple plans, honest units. Source minutes for editing, credits for generation, top-ups when you need them." },
      { property: "og:title", content: "Pricing — Vidrial" },
      { property: "og:url", content: "/pricing" },
    ],
    links: [{ rel: "canonical", href: "/pricing" }],
  }),
  component: PricingPage,
});

function PricingPage() {
  const [annual, setAnnual] = useState(true);
  return (
    <MarketingLayout>
      <MarketingPageHero
        eyebrow="Pricing"
        title="Simple plans, honest units."
        lead="Editing uses source minutes. Generated video, music and voice use separate credits. Vidrial always shows the cost before an expensive operation."
      />
      <Section className="pt-0">
        <div className="mb-8 flex items-center justify-center gap-2 text-sm">
          <button
            onClick={() => setAnnual(false)}
            aria-pressed={!annual}
            className={`rounded-full px-3 py-1.5 ${!annual ? "bg-ink text-surface-page" : "text-ink-soft"}`}
          >
            Monthly
          </button>
          <button
            onClick={() => setAnnual(true)}
            aria-pressed={annual}
            className={`rounded-full px-3 py-1.5 ${annual ? "bg-ink text-surface-page" : "text-ink-soft"}`}
          >
            Annual · save 2 months
          </button>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((p) => {
            const price = annual ? p.annual : p.monthly;
            return (
              <div
                key={p.name}
                className={`flex flex-col rounded-2xl border p-6 ${
                  p.featured ? "border-ember bg-surface-panel ring-2 ring-ember/20" : "border-line bg-surface-panel"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-display text-xl text-ink">{p.name}</div>
                  <StatusDot variant={p.featured ? "demo" : "muted"}>{p.tag}</StatusDot>
                </div>
                <div className="mt-3 font-display text-4xl text-ink">
                  ${price}
                  <span className="text-base text-ink-mute">/mo</span>
                </div>
                <div className="mt-1 text-xs text-ink-mute">
                  {annual && p.annual > 0
                    ? `Billed annually — $${p.annual * 12}/year`
                    : p.monthly === 0
                    ? "No credit card required"
                    : "Billed monthly"}
                </div>
                <ul className="mt-5 space-y-2 text-sm text-ink-soft">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-ember" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  disabled
                  title="Payments are not connected in this build"
                  className={`mt-6 rounded-md px-3 py-2 text-sm font-medium ${
                    p.featured
                      ? "bg-ink text-surface-page opacity-90"
                      : "border border-line bg-surface-panel text-ink"
                  }`}
                >
                  {p.cta}
                </button>
                <div className="mt-2 text-[11px] text-ink-mute">Checkout not connected — you'll join the waitlist.</div>
              </div>
            );
          })}
        </div>

        <div className="mt-10 max-w-3xl">
          <Callout title="What are source minutes?" tone="info">
            One source minute is one minute of your uploaded media that Vidrial analyses (transcription, tags, scenes). Editing the timeline itself is unmetered. Generated media (voice, music, video) uses separate credits, always with a preview cost.
          </Callout>
        </div>

        <div className="mt-14">
          <SectionHeader eyebrow="Compare" title="Plan comparison" />
          <ComparisonTable />
        </div>

        <div className="mt-14">
          <SectionHeader eyebrow="Billing FAQ" title="Common questions" />
          <FAQ />
        </div>
      </Section>
      <FinalCTA headline="Start on Free. Upgrade when it earns it." />
    </MarketingLayout>
  );
}

function ComparisonTable() {
  const rows: [string, string, string, string][] = [
    ["Active projects", "3", "Unlimited", "Unlimited"],
    ["Source minutes / mo", "60", "600", "1,800"],
    ["Storage", "2 GB", "50 GB", "250 GB"],
    ["Export resolution", "720p", "1080p", "4K"],
    ["Watermark", "Yes", "No", "No"],
    ["AI edit plans", "—", "Yes", "Yes"],
    ["Captions", "Basic", "Full", "Full"],
    ["Version history", "7 days", "90 days", "1 year"],
    ["Priority processing", "—", "—", "Yes"],
    ["Commercial use", "—", "Yes", "Yes"],
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-line">
      <table className="w-full text-sm">
        <thead className="bg-surface-raised text-left text-[12px] uppercase tracking-widest text-ink-mute">
          <tr>
            <th className="px-4 py-3 font-medium">Feature</th>
            <th className="px-4 py-3 font-medium">Free</th>
            <th className="px-4 py-3 font-medium">Creator</th>
            <th className="px-4 py-3 font-medium">Pro</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line bg-surface-panel">
          {rows.map((r) => (
            <tr key={r[0]}>
              <td className="px-4 py-2.5 text-ink">{r[0]}</td>
              <td className="px-4 py-2.5 text-ink-soft">{r[1]}</td>
              <td className="px-4 py-2.5 text-ink-soft">{r[2]}</td>
              <td className="px-4 py-2.5 text-ink-soft">{r[3]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FAQ() {
  const items = [
    { q: "What happens if I run out of source minutes?", a: "You can keep editing existing projects and buy a top-up. Nothing gets deleted." },
    { q: "Do unused minutes roll over?", a: "Free minutes reset each month. Paid-plan overages become one-off top-ups you can revoke." },
    { q: "Can I cancel any time?", a: "Yes. Paid plans keep working until the end of the billing period, then downgrade to Free." },
    { q: "Is my footage used to train AI models?", a: "Not unless you explicitly opt in — off by default and revocable at any time." },
    { q: "Where does rendering happen?", a: "In the cloud. During private beta, some heavy operations run in dedicated queues." },
  ];
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((it) => (
        <div key={it.q} className="rounded-2xl border border-line bg-surface-panel p-5">
          <div className="flex items-start gap-2">
            <HelpCircle className="mt-0.5 h-4 w-4 text-ember" />
            <div>
              <div className="font-medium text-ink">{it.q}</div>
              <div className="mt-1 text-sm text-ink-soft">{it.a}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}