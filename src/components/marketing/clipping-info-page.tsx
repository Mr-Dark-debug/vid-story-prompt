import { MarketingLayout } from "./layout";
import { MarketingPageHero, FinalCTA } from "./page-shell";
import { Section } from "@/components/primitives/section";

export function ClippingInfoPage({
  title,
  lead,
  sections,
}: {
  title: string;
  lead: string;
  sections: ReadonlyArray<{ title: string; body: string }>;
}) {
  return (
    <MarketingLayout>
      <MarketingPageHero title={title} lead={lead} />
      <Section>
        <div className="grid gap-4 md:grid-cols-2">
          {sections.map((section, index) => (
            <section
              key={section.title}
              className="min-w-0 rounded-2xl border border-line bg-surface-panel p-6 sm:p-8"
            >
              <span className="font-mono text-xs text-ink-mute">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h2 className="mt-4 font-display text-2xl text-ink">{section.title}</h2>
              <p className="mt-3 leading-relaxed text-ink-soft">{section.body}</p>
            </section>
          ))}
        </div>
      </Section>
      <FinalCTA
        headline="Your next clips start with one video."
        body="Bring content you own or are authorised to use. Start with the free plan."
      />
    </MarketingLayout>
  );
}
