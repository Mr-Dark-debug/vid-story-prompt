import type { ConnectorAvailability } from "@/domain/connectors/types";
import { cn } from "@/lib/utils";

const labels: Record<ConnectorAvailability, string> = {
  available: "Available",
  beta: "Beta",
  coming_soon: "Coming soon",
  disabled: "Unavailable",
};

export function AvailabilityBadge({
  availability,
  compact = false,
}: {
  availability: ConnectorAvailability;
  compact?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        availability === "available" && "border-success/20 bg-success/10 text-ink",
        availability === "beta" && "border-ember/25 bg-ember-soft text-ember-ink",
        (availability === "coming_soon" || availability === "disabled") &&
          "border-line bg-surface-sunken text-ink-mute",
      )}
    >
      {compact && availability === "coming_soon" ? "Soon" : labels[availability]}
    </span>
  );
}
