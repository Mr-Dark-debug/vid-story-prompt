import type { ReactNode } from "react";
import { MarketingLayout } from "./layout";
import { MarketingPageHero, ProseSection, FinalCTA } from "./page-shell";

export function SimpleMarketingPage({
  eyebrow,
  title,
  lead,
  children,
  cta = true,
  ctaHeadline = "Ready to try Vidrial?",
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  children: ReactNode;
  cta?: boolean;
  ctaHeadline?: ReactNode;
}) {
  return (
    <MarketingLayout>
      <MarketingPageHero eyebrow={eyebrow} title={title} lead={lead} />
      <ProseSection>{children}</ProseSection>
      {cta && <FinalCTA headline={ctaHeadline} />}
    </MarketingLayout>
  );
}

/** Legal / policy placeholder note. */
export function PlaceholderNote() {
  return (
    <div className="my-4 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-ink">
      <strong className="font-medium">Placeholder document.</strong> This copy is
      structural. Legal identity, addresses, subprocessors, retention periods and
      governing law are marked{" "}
      <code className="rounded bg-surface-sunken px-1 py-0.5">[TO BE COMPLETED]</code>{" "}
      and require legal review before publishing.
    </div>
  );
}