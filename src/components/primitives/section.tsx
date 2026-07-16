import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-5 sm:px-8", className)}>{children}</div>;
}

export function Section({
  className,
  children,
  id,
}: {
  className?: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className={cn("py-16 sm:py-24", className)}>
      <Container>{children}</Container>
    </section>
  );
}

/** @deprecated Eyebrow capsule removed — kept as a no-op export so existing imports compile. */
export function Eyebrow(_props: { children: ReactNode }) {
  return null;
}

export function SectionHeader({
  eyebrow,
  title,
  lead,
  align = "left",
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  align?: "left" | "center";
}) {
  return (
    <div className={cn("mb-10 max-w-2xl", align === "center" && "mx-auto text-center")}>
      <h2 className="font-display text-3xl font-medium leading-[1.1] tracking-tight text-ink sm:text-4xl">
        {title}
      </h2>
      {lead && <p className="mt-4 text-base leading-relaxed text-ink-soft sm:text-lg">{lead}</p>}
    </div>
  );
}

export function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warning" | "success" | "danger";
  title?: ReactNode;
  children: ReactNode;
}) {
  const toneMap = {
    info: "border-info/30 bg-info/8",
    warning: "border-warning/40 bg-warning/10",
    success: "border-success/30 bg-success/10",
    danger: "border-danger/30 bg-danger/8",
  } as const;
  return (
    <div className={cn("rounded-xl border px-4 py-3 text-sm text-ink-soft", toneMap[tone])}>
      {title && <div className="mb-1 font-medium text-ink">{title}</div>}
      {children}
    </div>
  );
}