import type { ReactNode } from "react";
import { MarketingLayout } from "./layout";
import { MarketingPageHero, FinalCTA } from "./page-shell";
import { Section, SectionHeader } from "@/components/primitives/section";
import { Check } from "lucide-react";

export function UseCaseTemplate({
  eyebrow,
  title,
  lead,
  scenario,
  prompts,
  outcomes,
}: {
  eyebrow: string;
  title: ReactNode;
  lead: ReactNode;
  scenario: ReactNode;
  prompts: string[];
  outcomes: string[];
}) {
  return (
    <MarketingLayout>
      <MarketingPageHero eyebrow={eyebrow} title={title} lead={lead} />
      <Section>
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="rounded-2xl border border-line bg-surface-panel p-6">
            <div className="text-[11px] font-medium uppercase tracking-widest text-ink-mute">Scenario</div>
            <div className="mt-3 text-ink-soft">{scenario}</div>
          </div>
          <div className="rounded-2xl border border-line bg-surface-panel p-6">
            <div className="text-[11px] font-medium uppercase tracking-widest text-ink-mute">Prompts that work well</div>
            <ul className="mt-3 space-y-2">
              {prompts.map((p) => (
                <li key={p} className="rounded-md border border-line bg-surface-page px-3 py-2 text-sm text-ink">
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-10">
          <SectionHeader eyebrow="Outcomes" title="What you tend to end up with" />
          <ul className="grid gap-2 sm:grid-cols-2">
            {outcomes.map((o) => (
              <li key={o} className="flex items-start gap-2 rounded-xl border border-line bg-surface-panel px-4 py-3 text-sm text-ink-soft">
                <Check className="mt-0.5 h-4 w-4 text-ember" /> {o}
              </li>
            ))}
          </ul>
        </div>
      </Section>
      <FinalCTA headline={`Start a ${eyebrow.toLowerCase()} project`} />
    </MarketingLayout>
  );
}
