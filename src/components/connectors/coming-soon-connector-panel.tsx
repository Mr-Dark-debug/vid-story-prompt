import { useState } from "react";
import { Bell, Check, LoaderCircle, ShieldCheck } from "lucide-react";
import type { ConnectorDefinition } from "@/domain/connectors/types";
import { joinConnectorWaitlist } from "@/services/connectors/server";
import { ConnectorIcon } from "./connector-icon";
import { AvailabilityBadge } from "./availability-badge";

export function ComingSoonConnectorPanel({ connector }: { connector: ConnectorDefinition }) {
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const notify = async () => {
    setState("saving");
    setError(null);
    try {
      await joinConnectorWaitlist({ data: { connectorId: connector.id } });
      setState("saved");
    } catch (cause) {
      setState("idle");
      setError(cause instanceof Error ? cause.message : "Waitlist interest could not be saved.");
    }
  };
  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-line bg-surface-raised">
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-surface-sunken text-ink-soft">
            <ConnectorIcon icon={connector.icon} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-xl text-ink">{connector.label}</h3>
              <AvailabilityBadge availability={connector.availability} />
            </div>
            <p className="mt-2 text-sm leading-6 text-ink-soft">{connector.description}</p>
          </div>
        </div>
        <div className="mt-5 flex items-start gap-2 rounded-xl border border-line bg-surface-panel px-4 py-3 text-xs leading-5 text-ink-mute">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            This connector cannot connect or import yet. Vidrial will never open a placeholder OAuth
            flow or simulate a successful connection.
          </span>
        </div>
        <button
          type="button"
          onClick={() => void notify()}
          disabled={state !== "idle"}
          className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-surface-page disabled:opacity-60"
        >
          {state === "saving" ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : state === "saved" ? (
            <Check className="h-4 w-4" />
          ) : (
            <Bell className="h-4 w-4" />
          )}
          {state === "saved" ? "You’re on the list" : "Notify me"}
        </button>
        {error ? (
          <p role="alert" className="mt-3 text-xs text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
