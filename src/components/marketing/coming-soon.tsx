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
            This screen is scaffolded in the current preview build. The full interactive
            experience — including the app dashboard, project editor, AI plan review and
            timeline prototype — is under active development and will populate this
            surface in subsequent updates.
          </p>
          {children}
        </div>
      </Section>
    </MarketingLayout>
  );
}