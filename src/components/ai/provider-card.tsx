import { KeyRound, LoaderCircle, MoreHorizontal, Plus, RefreshCw } from "lucide-react";
import { ProviderLogo } from "@/components/primitives/provider-logo";
import { StatusDot } from "@/components/primitives/status-dot";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AiConnection } from "@/services/ai/server";
import { describeConnection, formatVerified } from "./connection-status";

export type ProviderCardProvider = {
  id: string;
  label: string;
  description: string;
  availability: "available" | "beta" | "coming_soon";
  connectable: boolean;
};

export type ConnectionAction = "revalidate" | "refresh" | "replace" | "revoke" | "delete";

export function ProviderCard({
  provider,
  connections,
  busyId,
  canAdd,
  onAdd,
  onAction,
}: {
  provider: ProviderCardProvider;
  connections: AiConnection[];
  /** Connection id with an action in flight, if any. */
  busyId: string | null;
  canAdd: boolean;
  onAdd: () => void;
  onAction: (connection: AiConnection, action: ConnectionAction) => void;
}) {
  return (
    <section
      aria-labelledby={`ai-provider-${provider.id}`}
      className="rounded-xl border border-line bg-surface-panel p-5"
    >
      <header className="flex items-start gap-3">
        <ProviderLogo provider={provider.id} size={32} decorative className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id={`ai-provider-${provider.id}`} className="font-display text-lg text-ink">
              {provider.label}
            </h3>
            {provider.availability === "beta" ? <StatusDot variant="info">Beta</StatusDot> : null}
            {connections.length === 0 ? <StatusDot variant="muted">Not connected</StatusDot> : null}
          </div>
          <p className="mt-1 text-sm text-ink-soft">{provider.description}</p>
        </div>
        {provider.connectable ? (
          <Button
            type="button"
            size="sm"
            variant={connections.length ? "outline" : "default"}
            onClick={onAdd}
            disabled={!canAdd}
            aria-label={`${connections.length ? "Add another" : "Connect"} ${provider.label} key`}
          >
            <Plus aria-hidden />
            {connections.length ? "Add key" : "Connect"}
          </Button>
        ) : (
          <StatusDot variant="muted">Coming soon</StatusDot>
        )}
      </header>

      {connections.length ? (
        <ul className="mt-4 divide-y divide-line rounded-lg border border-line bg-surface-page">
          {connections.map((connection) => {
            const badge = describeConnection(connection);
            const busy = busyId === connection.id;
            const usable = connection.status !== "revoked";
            return (
              <li key={connection.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3">
                <KeyRound aria-hidden className="size-4 shrink-0 text-ink-mute" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-ink">
                      {connection.label}
                    </span>
                    <span className="font-mono text-xs text-ink-mute">••••{connection.last4}</span>
                    <StatusDot variant={badge.variant}>{badge.label}</StatusDot>
                  </div>
                  <p className="mt-0.5 text-xs text-ink-mute">
                    {badge.detail ? `${badge.detail} ` : ""}
                    {connection.status === "revoked"
                      ? ""
                      : `${formatVerified(connection.lastVerifiedAt)} · ${
                          connection.modelCount === null
                            ? "models not loaded"
                            : `${connection.modelCount} models`
                        }`}
                  </p>
                </div>
                {busy ? (
                  <LoaderCircle
                    aria-label="Working"
                    className="size-4 animate-spin text-ink-mute"
                  />
                ) : null}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={busy}
                      aria-label={`Actions for ${connection.label}`}
                    >
                      <MoreHorizontal aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {usable ? (
                      <>
                        <DropdownMenuItem onSelect={() => onAction(connection, "refresh")}>
                          <RefreshCw aria-hidden className="mr-2 size-4" />
                          Refresh models
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => onAction(connection, "revalidate")}>
                          Re-check key
                        </DropdownMenuItem>
                      </>
                    ) : null}
                    <DropdownMenuItem onSelect={() => onAction(connection, "replace")}>
                      {connection.status === "active" ? "Replace key" : "Reconnect with a new key"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {usable ? (
                      <DropdownMenuItem onSelect={() => onAction(connection, "revoke")}>
                        Revoke (erase stored key)
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem
                      className="text-danger focus:text-danger"
                      onSelect={() => onAction(connection, "delete")}
                    >
                      Delete connection
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
