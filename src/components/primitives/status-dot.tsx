import { cn } from "@/lib/utils";

type Variant = "demo" | "success" | "warning" | "danger" | "info" | "muted";

const map: Record<Variant, string> = {
  demo: "bg-ember/15 text-ember-ink ring-ember/30",
  success: "bg-success/12 text-success ring-success/30",
  warning: "bg-warning/15 text-ink ring-warning/40",
  danger: "bg-danger/12 text-danger ring-danger/30",
  info: "bg-info/10 text-info ring-info/30",
  muted: "bg-surface-sunken text-ink-mute ring-line",
};

export function StatusDot({
  children,
  variant = "muted",
  className,
}: {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        map[variant],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {children}
    </span>
  );
}