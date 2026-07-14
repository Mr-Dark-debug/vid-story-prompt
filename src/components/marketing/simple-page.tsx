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
