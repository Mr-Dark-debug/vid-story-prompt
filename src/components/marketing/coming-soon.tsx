import type { ReactNode } from "react";
import { MarketingLayout } from "./layout";
import { MarketingPageHero } from "./page-shell";
import { Section } from "@/components/primitives/section";
import { StatusDot } from "@/components/primitives/status-dot";

export function ComingSoonPage({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <MarketingLayout>
      <MarketingPageHero eyebrow={eyebrow} title={title} lead={lead} />
      <Section>
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-surface-panel p-6">
          <StatusDot variant="demo">In this build</StatusDot>
          <p className="mt-3 text-ink-soft">
            This capability is not available yet. Vidrial is focused on importing authorised videos,
            finding complete moments and exporting short clips. Future capabilities will be labelled
            available only after their real workflow is verified.
          </p>
          {children}
        </div>
      </Section>
    </MarketingLayout>
  );
}
