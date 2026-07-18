import { useEffect, useState } from "react";
import { CheckCircle2, CircleHelp, ShieldAlert, TriangleAlert } from "lucide-react";
import { getWorkerEgressHealth, type WorkerEgressHealth } from "@/services/worker/server";
import { cn } from "@/lib/utils";

const presentation = {
  healthy: {
    Icon: CheckCircle2,
    label: "Healthy",
    className: "border-success/25 bg-success/10 text-success",
  },
  degraded: {
    Icon: TriangleAlert,
    label: "Degraded",
    className: "border-warning/30 bg-warning/10 text-warning",
  },
  blocked: {
    Icon: ShieldAlert,
    label: "Blocked",
    className: "border-danger/25 bg-danger/10 text-danger",
  },
  unknown: {
    Icon: CircleHelp,
    label: "Checking",
    className: "border-line bg-surface-sunken text-ink-mute",
  },
} as const;

const initialHealth: WorkerEgressHealth = {
  checkedAt: null,
  message: "Checking worker egress health.",
  status: "unknown",
  tier: "none",
};

export function WorkerEgressBadge({ health }: { health?: WorkerEgressHealth }) {
  const [current, setCurrent] = useState(health ?? initialHealth);

  useEffect(() => {
    if (health) {
      setCurrent(health);
      return;
    }
    let active = true;
    void getWorkerEgressHealth()
      .then((result) => {
        if (active) setCurrent(result);
      })
      .catch(() => {
        if (active)
          setCurrent({
            checkedAt: null,
            message: "The worker health check could not be reached.",
            status: "blocked",
            tier: "none",
          });
      });
    return () => {
      active = false;
    };
  }, [health]);

  const state = presentation[current.status];
  return (
    <div
      role="status"
      aria-label={`Worker egress: ${state.label}`}
      title={current.message}
      className={cn(
        "inline-flex min-w-0 max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold",
        state.className,
      )}
    >
      <state.Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">Worker egress: {state.label}</span>
    </div>
  );
}
