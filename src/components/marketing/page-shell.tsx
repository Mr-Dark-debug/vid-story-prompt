import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Container, Eyebrow } from "@/components/primitives/section";

export function MarketingPageHero({
  eyebrow,
  title,
  lead,
  actions,
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="border-b border-line bg-gradient-to-b from-surface-page to-surface-raised">
      <Container className="py-16 sm:py-24">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1 className="mt-4 max-w-3xl font-display text-4xl font-medium leading-[1.05] tracking-tight text-ink sm:text-5xl">
          {title}
        </h1>
        {lead && <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-soft">{lead}</p>}
        {actions && <div className="mt-8 flex flex-wrap gap-3">{actions}</div>}
      </Container>
    </section>
  );
}

export function CTAButton({
  to,
  children,
  variant = "primary",
}: {
  to: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
}) {
  const cls =
    variant === "primary"
      ? "inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2.5 text-sm font-medium text-surface-page transition-transform hover:-translate-y-px"
      : "inline-flex items-center gap-2 rounded-md border border-line bg-surface-panel px-4 py-2.5 text-sm font-medium text-ink hover:bg-surface-sunken";
  return (
    <Link to={to} className={cls}>
      {children}
    </Link>
  );
}

export function ProseSection({
  title,
  children,
}: {
  title?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="py-14">
      <Container>
        <div className="mx-auto max-w-3xl">
          {title && (
            <h2 className="mb-6 font-display text-2xl text-ink sm:text-3xl">{title}</h2>
          )}
          <div className="space-y-4 text-[15.5px] leading-relaxed text-ink-soft [&_h3]:mt-8 [&_h3]:font-display [&_h3]:text-lg [&_h3]:text-ink [&_ul]:list-disc [&_ul]:pl-5 [&_a]:text-ember-ink [&_a]:underline">
            {children}
          </div>
        </div>
      </Container>
    </section>
  );
}

export function FinalCTA({
  headline,
  body,
  actionLabel = "Create your first project",
  to = "/signup",
}: {
  headline: ReactNode;
  body?: ReactNode;
  actionLabel?: string;
  to?: string;
}) {
  return (
    <section className="border-t border-line bg-surface-raised py-20">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl text-ink sm:text-4xl">{headline}</h2>
          {body && <p className="mt-3 text-ink-soft">{body}</p>}
          <div className="mt-6 flex justify-center gap-3">
            <CTAButton to={to}>{actionLabel}</CTAButton>
            <CTAButton to="/how-it-works" variant="secondary">
              See how it works
            </CTAButton>
          </div>
        </div>
      </Container>
    </section>
  );
}