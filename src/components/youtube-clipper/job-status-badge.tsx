import { cn } from "@/lib/utils";
import { getJobStatusPresentation } from "@/domain/clipping/job-progress";

const toneClasses = {
  success: "border-success/25 bg-success/10 text-success",
  active: "border-ember/30 bg-ember/10 text-ember-ink",
  info: "border-line-strong bg-surface-sunken text-ink-soft",
  warning: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-danger/25 bg-danger/10 text-danger",
  neutral: "border-line bg-surface-sunken text-ink-mute",
} as const;

export function JobStatusBadge({ status, className }: { status: string; className?: string }) {
  const presentation = getJobStatusPresentation(status);
  return (
    <span
      data-tone={presentation.tone}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        toneClasses[presentation.tone],
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "h-1.5 w-1.5 rounded-full bg-current",
          presentation.active && "animate-pulse motion-reduce:animate-none",
        )}
      />
      {presentation.label}
    </span>
  );
}
