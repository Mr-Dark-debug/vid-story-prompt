import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { MarketingLayout } from "@/components/marketing/layout";
import { Section } from "@/components/primitives/section";
import { MarketingPageHero, FinalCTA } from "@/components/marketing/page-shell";
import { PLAN_ENTITLEMENTS, type PlanKey } from "@/domain/clipping/entitlements";
import { pageMeta } from "@/config/seo";
import { trackAnalyticsEvent } from "@/services/analytics/client";

const prices: Record<PlanKey, { monthly: number; annual: number }> = {
  free: { monthly: 0, annual: 0 },
  creator: { monthly: 18, annual: 15 },
  pro: { monthly: 39, annual: 32 },
};
export const Route = createFileRoute("/pricing")({
  head: () =>
    pageMeta({
      title: "Video Clipping Plans & Pricing — Vidrial",
      description:
        "Compare clipping plans by source minutes, clips per job, export quality and retention. Start free; paid upgrades are not yet available.",
      path: "/pricing",
    }),
  component: PricingPage,
});
function PricingPage() {
  const [annual, setAnnual] = useState(false);
  useEffect(() => trackAnalyticsEvent("pricing_viewed"), []);
  return (
    <MarketingLayout>
      <MarketingPageHero
        title="More moments. A plan that fits."
        lead="Pay for source minutes and clipping capacity, not an online editor. Free is available now. Creator and Pro are planned offers; checkout is not open."
      />
      <Section>
        <div className="mb-8 flex flex-wrap justify-center gap-2" aria-label="Price display">
          {[false, true].map((value) => (
            <button
              key={String(value)}
              onClick={() => setAnnual(value)}
              aria-pressed={annual === value}
              className={`min-h-11 rounded-full border border-line px-4 text-sm ${annual === value ? "bg-ink text-surface-page" : "text-ink-soft"}`}
            >
              {value ? "Annual pricing" : "Monthly pricing"}
            </button>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {Object.values(PLAN_ENTITLEMENTS).map((plan) => {
            const price = prices[plan.key][annual ? "annual" : "monthly"];
            const features = [
              `${(plan.monthlySourceSeconds / 60).toLocaleString("en")} source minutes / month`,
              `Up to ${plan.maxSourceSecondsPerJob / 60} minutes per source`,
              `Up to ${plan.maxClipsPerJob} clips per job`,
              `${plan.maxConcurrentJobs} concurrent clipping ${plan.maxConcurrentJobs === 1 ? "job" : "jobs"}`,
              `Up to ${plan.maxExport.height === 2160 ? "4K" : plan.maxExport.height + "p"} exports · ${plan.maxExport.fps} fps`,
              plan.watermarkRequired
                ? "Watermarked exports + 1 watermark-free trial export"
                : "No Vidrial watermark",
              `${plan.retentionDays}-day media retention`,
            ];
            return (
              <section
                key={plan.key}
                className="flex min-w-0 flex-col rounded-2xl border border-line bg-surface-panel p-6 sm:p-8"
              >
                <p className="text-xs text-ink-mute">
                  {plan.key === "free" ? "Available now" : "Planned · not yet purchasable"}
                </p>
                <h2 className="mt-2 font-display text-2xl capitalize text-ink">{plan.key}</h2>
                <p className="mt-5 font-display text-4xl text-ink">
                  ${price}
                  <span className="text-base text-ink-soft"> / month</span>
                </p>
                <p className="mt-2 text-xs text-ink-mute">
                  {price === 0
                    ? "No card required"
                    : annual
                      ? `Planned annual total: $${price * 12}. No charge today.`
                      : "Planned monthly price. No charge today."}
                </p>
                <ul className="my-6 space-y-3 text-sm text-ink-soft">
                  {features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                {plan.key === "free" ? (
                  <Link
                    to="/signup"
                    className="mt-auto inline-flex min-h-11 items-center justify-center rounded-lg bg-ink px-4 py-3 text-sm font-medium text-surface-page"
                  >
                    Create free account
                  </Link>
                ) : (
                  <Link
                    to="/login"
                    search={{ redirect: "/app/billing" }}
                    className="mt-auto inline-flex min-h-11 items-center justify-center rounded-lg border border-line px-4 py-3 text-sm font-medium text-ink"
                  >
                    Register upgrade interest
                  </Link>
                )}
              </section>
            );
          })}
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {[
            [
              "What counts as a source minute?",
              "The duration of source media analysed for a clipping job, not the combined length of exported clips. Your workspace shows reserved and used minutes.",
            ],
            [
              "What happens when I reach a limit?",
              "New work that exceeds your remaining allowance is blocked. Review usage or wait for the next allowance period. Paid top-ups are not currently offered.",
            ],
            [
              "How long are clips kept?",
              "Retention depends on your plan. Download finished clips before they expire; do not use Vidrial as your only archive.",
            ],
            [
              "Does a plan guarantee YouTube downloads?",
              "No. Network restrictions and source eligibility can prevent acquisition. Connecting a YouTube account lists authorised content but does not unlock downloading.",
            ],
          ].map(([title, body]) => (
            <section key={title}>
              <h2 className="font-display text-xl text-ink">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{body}</p>
            </section>
          ))}
        </div>
      </Section>
      <FinalCTA headline="Start with one video." body="60 source minutes each month on Free." />
    </MarketingLayout>
  );
}
