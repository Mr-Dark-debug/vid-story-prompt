import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, ChevronsUpDown, Clock3, Grid2X2, Search, X } from "lucide-react";
import { CONNECTOR_REGISTRY, getConnector } from "@/domain/connectors/registry";
import {
  filterConnectors,
  groupConnectors,
  searchConnectors,
  type ConnectorFilter,
} from "@/domain/connectors/catalog";
import type { ConnectorDefinition } from "@/domain/connectors/types";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConnectorIcon } from "./connector-icon";
import { AvailabilityBadge } from "./availability-badge";

const RECENT_KEY = "vidrial.recent-connectors.v1";
const quickIds = ["local_upload", "youtube", "google_drive", "direct_url"] as const;
const filters: { id: ConnectorFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "connected", label: "Connected" },
  { id: "available", label: "Available" },
  { id: "beta", label: "Beta" },
  { id: "coming_soon", label: "Coming soon" },
  { id: "video", label: "Video" },
  { id: "cloud", label: "Cloud" },
  { id: "recording", label: "Recording" },
  { id: "podcast", label: "Podcast" },
  { id: "automation", label: "Automation" },
];

function readRecent() {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string").slice(0, 5)
      : [];
  } catch {
    return [];
  }
}

export function SourcePicker({
  value,
  onChange,
  connectedIds = [],
  connectors = CONNECTOR_REGISTRY,
}: {
  value: string;
  onChange: (connector: ConnectorDefinition) => void;
  connectedIds?: readonly string[];
  connectors?: readonly ConnectorDefinition[];
}) {
  const selected =
    connectors.find((connector) => connector.id === value) ?? getConnector("youtube")!;
  const [open, setOpen] = useState(false);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const mobile = useIsMobile();

  useEffect(() => setRecentIds(readRecent()), []);

  const choose = (connector: ConnectorDefinition) => {
    const recent = [connector.id, ...recentIds.filter((id) => id !== connector.id)].slice(0, 5);
    setRecentIds(recent);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
    onChange(connector);
    setOpen(false);
    setDirectoryOpen(false);
  };

  const trigger = (
    <button
      type="button"
      aria-label="Choose source"
      aria-expanded={open}
      className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-line bg-surface-page px-4 text-left shadow-sm transition-colors hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-sunken text-ink-soft">
        <ConnectorIcon icon={selected.icon} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold uppercase tracking-[.12em] text-ink-mute">
          Choose source
        </span>
        <span className="mt-0.5 block truncate text-sm font-semibold text-ink">
          {selected.label}
        </span>
      </span>
      <AvailabilityBadge availability={selected.availability} compact />
      <ChevronsUpDown className="h-4 w-4 shrink-0 text-ink-mute" />
    </button>
  );

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {quickIds.map((id) => {
          const connector = connectors.find((item) => item.id === id) ?? getConnector(id)!;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={connector.id === selected.id}
              onClick={() => choose(connector)}
              className={cn(
                "group min-w-0 rounded-2xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember",
                connector.id === selected.id
                  ? "border-ember bg-ember-soft/40"
                  : "border-line bg-surface-raised hover:border-line-strong",
              )}
            >
              <span className="flex items-start justify-between gap-2">
                <ConnectorIcon
                  icon={connector.icon}
                  className={connector.id === selected.id ? "text-ember-ink" : "text-ink-soft"}
                />
                {connector.availability !== "available" ? (
                  <AvailabilityBadge availability={connector.availability} compact />
                ) : null}
              </span>
              <span className="mt-3 block truncate text-xs font-semibold text-ink sm:text-sm">
                {connector.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        {mobile ? (
          <Drawer open={open} onOpenChange={setOpen}>
            <div onClick={() => setOpen(true)}>{trigger}</div>
            <DrawerContent className="max-h-[86vh] rounded-t-3xl border-line bg-surface-page">
              <DrawerHeader className="border-b border-line text-left">
                <DrawerTitle className="text-ink">Choose source</DrawerTitle>
                <DrawerDescription>Search every available and planned connector.</DrawerDescription>
              </DrawerHeader>
              <PickerList
                connectors={connectors}
                value={value}
                recentIds={recentIds}
                connectedIds={connectedIds}
                onChoose={choose}
              />
            </DrawerContent>
          </Drawer>
        ) : (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>{trigger}</PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-[min(42rem,calc(100vw-3rem))] overflow-hidden rounded-2xl border-line bg-surface-page p-0 shadow-xl"
            >
              <PickerList
                connectors={connectors}
                value={value}
                recentIds={recentIds}
                connectedIds={connectedIds}
                onChoose={choose}
              />
            </PopoverContent>
          </Popover>
        )}
      </div>

      <button
        type="button"
        onClick={() => setDirectoryOpen(true)}
        className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-ember-ink hover:underline"
      >
        <Grid2X2 className="h-3.5 w-3.5" /> Browse all sources
      </button>

      <SourceDirectory
        connectors={connectors}
        open={directoryOpen}
        onOpenChange={setDirectoryOpen}
        connectedIds={connectedIds}
        onChoose={choose}
      />
    </div>
  );
}

function PickerList({
  connectors,
  value,
  recentIds,
  connectedIds,
  onChoose,
}: {
  connectors: readonly ConnectorDefinition[];
  value: string;
  recentIds: readonly string[];
  connectedIds: readonly string[];
  onChoose: (connector: ConnectorDefinition) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => searchConnectors(connectors, query), [connectors, query]);
  const groups = groupConnectors(filtered);
  const recent = recentIds
    .map((id) => connectors.find((connector) => connector.id === id))
    .filter((item): item is ConnectorDefinition => Boolean(item))
    .slice(0, 4);
  return (
    <div className="min-h-0">
      <label className="flex h-13 items-center gap-2 border-b border-line px-4">
        <Search className="h-4 w-4 text-ink-mute" />
        <span className="sr-only">Search sources</span>
        <input
          autoFocus
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search sources or categories"
          className="h-full min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-mute"
        />
        {query ? (
          <button type="button" onClick={() => setQuery("")} aria-label="Clear source search">
            <X className="h-4 w-4 text-ink-mute" />
          </button>
        ) : null}
      </label>
      <div className="max-h-[min(62vh,30rem)] overflow-y-auto p-2">
        {!query && recent.length > 0 ? (
          <PickerGroup
            label="Recently used"
            icon={<Clock3 className="h-3.5 w-3.5" />}
            connectors={recent}
            value={value}
            connectedIds={connectedIds}
            onChoose={onChoose}
          />
        ) : null}
        {groups.map((group) => (
          <PickerGroup
            key={group.category}
            label={group.label}
            connectors={group.connectors}
            value={value}
            connectedIds={connectedIds}
            onChoose={onChoose}
          />
        ))}
        {!groups.length ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm font-medium text-ink">No source matches “{query}”</p>
            <p className="mt-1 text-xs text-ink-mute">
              Use Other source for an owner-controlled HTTPS media URL.
            </p>
            <button
              type="button"
              onClick={() => onChoose(getConnector("other")!)}
              className="mt-4 rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-surface-page"
            >
              Choose Other source
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PickerGroup({
  label,
  icon,
  connectors,
  value,
  connectedIds,
  onChoose,
}: {
  label: string;
  icon?: ReactNode;
  connectors: readonly ConnectorDefinition[];
  value: string;
  connectedIds: readonly string[];
  onChoose: (connector: ConnectorDefinition) => void;
}) {
  return (
    <section className="mb-2 last:mb-0">
      <h3 className="flex items-center gap-1.5 px-2 py-2 text-[10px] font-semibold uppercase tracking-[.14em] text-ink-mute">
        {icon}
        {label}
      </h3>
      {connectors.map((connector) => (
        <button
          key={connector.id}
          type="button"
          onClick={() => onChoose(connector)}
          className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line bg-surface-raised text-ink-soft">
            <ConnectorIcon icon={connector.icon} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 text-sm font-medium text-ink">
              {connector.label}
              {connectedIds.includes(connector.id) ? (
                <span className="text-[10px] font-semibold text-success">Connected</span>
              ) : null}
            </span>
            <span className="mt-0.5 block truncate text-xs text-ink-mute">
              {connector.description}
            </span>
          </span>
          <AvailabilityBadge availability={connector.availability} compact />
          {connector.id === value ? <Check className="h-4 w-4 shrink-0 text-ember-ink" /> : null}
        </button>
      ))}
    </section>
  );
}

function SourceDirectory({
  connectors: definitions,
  open,
  onOpenChange,
  connectedIds,
  onChoose,
}: {
  connectors: readonly ConnectorDefinition[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectedIds: readonly string[];
  onChoose: (connector: ConnectorDefinition) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ConnectorFilter>("all");
  const connectors = useMemo(
    () =>
      filterConnectors(
        searchConnectors(
          definitions.map((connector) => ({
            ...connector,
            connected: connectedIds.includes(connector.id),
          })),
          query,
        ),
        filter,
      ),
    [connectedIds, definitions, filter, query],
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] w-[min(72rem,calc(100vw-2rem))] max-w-none flex-col gap-0 overflow-hidden rounded-3xl border-line bg-surface-page p-0">
        <DialogHeader className="border-b border-line p-5 pr-12 sm:p-6">
          <DialogTitle className="font-display text-2xl text-ink">Source directory</DialogTitle>
          <DialogDescription>
            Browse available, beta, and planned ways to bring authorised media into Vidrial.
          </DialogDescription>
        </DialogHeader>
        <div className="border-b border-line p-4 sm:px-6">
          <label className="flex h-11 items-center gap-2 rounded-xl border border-line bg-surface-raised px-3">
            <Search className="h-4 w-4 text-ink-mute" />
            <span className="sr-only">Search source directory</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by source or category"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </label>
          <div className="scrollbar-hidden mt-3 flex gap-2 overflow-x-auto pb-1">
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={filter === item.id}
                onClick={() => setFilter(item.id)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium",
                  filter === item.id
                    ? "border-ink bg-ink text-surface-page"
                    : "border-line bg-surface-page text-ink-soft",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {connectors.map((connector) => (
              <button
                key={connector.id}
                type="button"
                onClick={() => onChoose(connector)}
                className="rounded-2xl border border-line bg-surface-raised p-4 text-left transition-colors hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-surface-sunken text-ink-soft">
                    <ConnectorIcon icon={connector.icon} />
                  </span>
                  <AvailabilityBadge availability={connector.availability} />
                </span>
                <span className="mt-4 flex items-center gap-2 text-sm font-semibold text-ink">
                  {connector.label}
                  {connectedIds.includes(connector.id) ? (
                    <span className="text-[10px] text-success">Connected</span>
                  ) : null}
                </span>
                <span className="mt-1.5 block text-xs leading-5 text-ink-mute">
                  {connector.description}
                </span>
              </button>
            ))}
          </div>
          {!connectors.length ? (
            <p className="py-12 text-center text-sm text-ink-mute">
              No connectors match these filters.
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
