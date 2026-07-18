import { ConnectorIcon } from "@/components/connectors/connector-icon";
import { AvailabilityBadge } from "@/components/connectors/availability-badge";
import { StatusDot } from "@/components/primitives/status-dot";
import { CATEGORY_LABELS, type PublicConnectorDefinition } from "@/domain/connectors/types";

export function ConnectorSettingsOverview({
  catalog,
  onOpen,
}: {
  catalog: PublicConnectorDefinition[];
  onOpen: (connectorId: string) => void;
}) {
  const groups = Object.entries(CATEGORY_LABELS)
    .map(([category, label]) => ({
      category,
      label,
      connectors: catalog.filter((connector) => connector.category === category),
    }))
    .filter((group) => group.connectors.length > 0);

  return (
    <section className="rounded-3xl border border-line bg-surface-panel p-6 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-ember-ink">
            Source connections
          </p>
          <h1 className="mt-2 font-display text-2xl text-ink">Integrations</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">
            Every connector appears once. Open one to import, connect, configure automation, or
            record interest without mixing its permission boundaries.
          </p>
        </div>
        <a
          href="/app/youtube-clipper/new"
          className="rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-surface-page"
        >
          Import media
        </a>
      </div>

      <div className="mt-7 space-y-7">
        {groups.map((group) => (
          <div key={group.category}>
            <h2 className="text-sm font-semibold text-ink">{group.label}</h2>
            <p className="mt-1 text-xs leading-5 text-ink-mute">
              Select a connector to view its live availability, capabilities, and permitted actions.
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {group.connectors.map((connector) => (
                <button
                  key={connector.id}
                  type="button"
                  data-connector-trigger={connector.id}
                  onClick={() => onOpen(connector.id)}
                  className="group rounded-2xl border border-line bg-surface-raised p-4 text-left transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember"
                >
                  <span className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-sunken text-ink-soft">
                      <ConnectorIcon connectorId={connector.id} icon={connector.icon} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-ink">{connector.label}</span>
                        {connector.connected ? (
                          <StatusDot variant="success">Connected</StatusDot>
                        ) : (
                          <AvailabilityBadge availability={connector.availability} compact />
                        )}
                      </span>
                      <span className="mt-1 line-clamp-2 block text-xs leading-5 text-ink-mute">
                        {connector.description}
                      </span>
                      <span className="mt-3 inline-flex text-xs font-semibold text-ember-ink">
                        {connector.connected ? "Manage settings" : "View details"}
                      </span>
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
