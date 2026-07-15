import { createFileRoute } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing/layout";
import { Logo, LogoMark } from "@/components/primitives/logo";
import { Section, SectionHeader, Callout } from "@/components/primitives/section";
import { StatusDot } from "@/components/primitives/status-dot";
import { UsageMeter } from "@/components/primitives/usage-meter";

export const Route = createFileRoute("/design-system")({
  head: () => ({ meta: [{ title: "Design system — Vidrial" }] }),
  component: DesignSystem,
});

const palette = [
  { name: "Vidrial Charcoal", value: "#1D1D1B", className: "bg-[#1D1D1B]" },
  { name: "Vidrial Medium", value: "#787C7F", className: "bg-[#787C7F]" },
  { name: "Vidrial Cool", value: "#B5BCC4", className: "bg-[#B5BCC4]" },
  { name: "Vidrial Coral", value: "#EF8668", className: "bg-[#EF8668]" },
] as const;

function DesignSystem() {
  return (
    <MarketingLayout>
      <Section>
        <SectionHeader
          eyebrow="Brand system"
          title="Vidrial identity"
          lead="A restrained, museum-inspired system for an explainable creative tool."
        />

        <h3 className="mb-3 font-display text-xl text-ink">Logo</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex min-h-40 items-center justify-center rounded-2xl border border-line bg-white p-8">
            <Logo size="lg" showTagline />
          </div>
          <div className="flex min-h-40 items-center justify-center rounded-2xl bg-[#1D1D1B] p-8">
            <Logo tone="light" size="lg" showTagline />
          </div>
          <div className="flex min-h-28 items-center justify-center rounded-2xl border border-line bg-surface-raised p-8">
            <LogoMark tone="dark" className="h-16 w-16" />
          </div>
          <div className="flex min-h-28 items-center justify-center rounded-2xl bg-[#787C7F] p-8">
            <LogoMark tone="light" className="h-16 w-16" />
          </div>
        </div>

        <h3 className="mb-3 mt-10 font-display text-xl text-ink">Colour</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {palette.map((token) => (
            <div
              key={token.value}
              className="overflow-hidden rounded-xl border border-line bg-surface-panel"
            >
              <div className={`${token.className} h-20`} />
              <div className="px-3 py-3">
                <div className="text-xs font-semibold text-ink">{token.name}</div>
                <div className="mt-1 font-mono text-[11px] text-ink-mute">{token.value}</div>
              </div>
            </div>
          ))}
        </div>

        <h3 className="mb-3 mt-10 font-display text-xl text-ink">Typography</h3>
        <div className="space-y-4 rounded-2xl border border-line bg-surface-panel p-6 sm:p-8">
          <div className="font-display text-4xl font-extrabold text-ink sm:text-5xl">
            Museum Sans
          </div>
          <div className="font-display text-3xl font-medium text-ink">
            AI-assisted video editing
          </div>
          <p className="max-w-2xl text-base leading-relaxed text-ink-soft">
            Museum Sans is the licensed brand typeface. Manrope is the approved web fallback until
            licensed font files are available.
          </p>
          <div className="font-mono text-sm text-ink-soft">JetBrains Mono · 00:42:18</div>
        </div>

        <h3 className="mb-3 mt-10 font-display text-xl text-ink">Usage rules</h3>
        <div className="grid gap-3 text-sm leading-relaxed text-ink-soft sm:grid-cols-2">
          <Callout tone="info" title="Use">
            Dark artwork on white or cool-neutral fields; light artwork on charcoal or dark media.
            Keep clear space equal to at least one quarter of the mark height.
          </Callout>
          <Callout tone="warning" title="Avoid">
            Never stretch, rotate, outline, shadow, recolour, crop, or place the logo over a
            low-contrast or visually busy field.
          </Callout>
        </div>

        <h3 className="mb-3 mt-10 font-display text-xl text-ink">Status and data</h3>
        <div className="flex flex-wrap gap-2">
          <StatusDot variant="success">success</StatusDot>
          <StatusDot variant="info">info</StatusDot>
          <StatusDot variant="warning">warning</StatusDot>
          <StatusDot variant="danger">danger</StatusDot>
          <StatusDot variant="demo">demo</StatusDot>
          <StatusDot variant="muted">muted</StatusDot>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-4 rounded-2xl border border-line bg-surface-panel p-5">
            <UsageMeter label="Source minutes" used={214} total={600} unit="min" />
            <UsageMeter label="AI operations" used={128} total={500} unit="ops" tone="teal" />
          </div>
          <div className="space-y-3">
            <Callout tone="info" title="Info">
              Contextual help.
            </Callout>
            <Callout tone="warning" title="Warning">
              Watch out.
            </Callout>
            <Callout tone="danger" title="Danger">
              Destructive action.
            </Callout>
          </div>
        </div>
      </Section>
    </MarketingLayout>
  );
}
