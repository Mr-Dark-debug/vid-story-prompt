import {
  CATEGORY_LABELS,
  type ConnectorAvailability,
  type ConnectorCategory,
  type ConnectorDefinition,
} from "./types";

export type ConnectorFilter =
  | "all"
  | "connected"
  | "available"
  | "beta"
  | "coming_soon"
  | "video"
  | "cloud"
  | "recording"
  | "podcast"
  | "automation";

export function searchConnectors(connectors: readonly ConnectorDefinition[], query: string) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [...connectors];
  return connectors.filter((connector) => {
    const haystack = [
      connector.label,
      connector.description,
      CATEGORY_LABELS[connector.category],
      connector.category.replaceAll("_", " "),
      ...connector.capabilities,
      ...(connector.searchTerms ?? []),
    ]
      .join(" ")
      .toLocaleLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}

export function groupConnectors(connectors: readonly ConnectorDefinition[]) {
  return Object.entries(CATEGORY_LABELS)
    .map(([category, label]) => ({
      category: category as ConnectorCategory,
      label,
      connectors: connectors.filter((connector) => connector.category === category),
    }))
    .filter((group) => group.connectors.length > 0);
}

export function filterConnectors(
  connectors: readonly (ConnectorDefinition & { connected?: boolean })[],
  filter: ConnectorFilter,
) {
  if (filter === "all") return [...connectors];
  if (filter === "connected") return connectors.filter((connector) => connector.connected);
  if (["available", "beta", "coming_soon"].includes(filter))
    return connectors.filter(
      (connector) => connector.availability === (filter as ConnectorAvailability),
    );
  const categories: Record<
    Exclude<ConnectorFilter, "all" | "connected" | ConnectorAvailability>,
    ConnectorCategory
  > = {
    video: "video_platforms",
    cloud: "cloud_storage",
    recording: "recording_platforms",
    podcast: "podcast_audio",
    automation: "developer_automation",
  };
  return connectors.filter(
    (connector) => connector.category === categories[filter as keyof typeof categories],
  );
}

export function orderWithRecent<T extends ConnectorDefinition>(
  connectors: readonly T[],
  recentIds: readonly string[],
) {
  const rank = new Map(recentIds.map((id, index) => [id, index]));
  return [...connectors].sort((a, b) => {
    const aRank = rank.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bRank = rank.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    return aRank - bRank || a.label.localeCompare(b.label);
  });
}
