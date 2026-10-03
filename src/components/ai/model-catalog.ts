// Pure view-model helpers for the model picker. No React, no network.
import { getAiProvider } from "@/domain/ai/providers";
import type { ModelPricing, NormalizedModel } from "@/domain/ai/types";
import type { AiModelGroup } from "@/services/ai/server";

export type PickerModel = NormalizedModel & {
  credentialId: string;
  credentialLabel: string;
  providerLabel: string;
  key: string;
};

export type PickerSection = { id: string; label: string; models: PickerModel[] };

export const SEARCH_RESULT_LIMIT = 150;
const RECENT_LIMIT = 5;

export function modelKey(credentialId: string, modelId: string) {
  return `${credentialId}::${modelId}`;
}

export function parseModelKey(key: string): { credentialId: string; modelId: string } | null {
  const separator = key.indexOf("::");
  if (separator < 1 || separator === key.length - 2) return null;
  return { credentialId: key.slice(0, separator), modelId: key.slice(separator + 2) };
}

/** Only usable connections contribute models; invalid or revoked keys cannot run anything. */
export function flattenGroups(groups: readonly AiModelGroup[]): PickerModel[] {
  const models: PickerModel[] = [];
  for (const group of groups) {
    if (group.status !== "active") continue;
    const providerLabel = getAiProvider(group.providerId)?.label ?? group.providerId;
    for (const model of group.models) {
      models.push({
        ...model,
        credentialId: group.credentialId,
        credentialLabel: group.label,
        providerLabel,
        key: modelKey(group.credentialId, model.modelId),
      });
    }
  }
  return models;
}

export function formatContext(tokens: number | null | undefined): string | null {
  if (!tokens || tokens <= 0) return null;
  if (tokens >= 1_000_000) return `${Number((tokens / 1_000_000).toFixed(1))}M`;
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}K`;
  return String(tokens);
}

function dollars(value: number) {
  return value >= 100 ? value.toFixed(0) : String(Number(value.toFixed(2)));
}

/** A price hint only exists when the provider published pricing; nothing is ever estimated. */
export function priceHint(pricing: ModelPricing | undefined): string | null {
  if (!pricing) return null;
  const { inputPerMillion: input, outputPerMillion: output } = pricing;
  if (input === null || output === null) return null;
  if (input === 0 && output === 0) return "Free";
  return `$${dollars(input)} in · $${dollars(output)} out / 1M tokens`;
}

export function capabilityChips(model: NormalizedModel): string[] {
  const chips: string[] = [];
  if (model.supportsVision) chips.push("Vision");
  if (model.supportsJsonSchema) chips.push("JSON");
  return chips;
}

export function searchModels(
  models: readonly PickerModel[],
  query: string,
  limit = SEARCH_RESULT_LIMIT,
): PickerModel[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return models.slice(0, limit);
  const matches: PickerModel[] = [];
  for (const model of models) {
    const haystack =
      `${model.displayName} ${model.modelId} ${model.providerLabel} ${model.family}`.toLowerCase();
    if (terms.every((term) => haystack.includes(term))) {
      matches.push(model);
      if (matches.length >= limit) break;
    }
  }
  return matches;
}

function newestFirst(left: PickerModel, right: PickerModel) {
  if (left.createdAt && right.createdAt && left.createdAt !== right.createdAt) {
    return left.createdAt < right.createdAt ? 1 : -1;
  }
  if (Boolean(left.createdAt) !== Boolean(right.createdAt)) return left.createdAt ? -1 : 1;
  return left.displayName.localeCompare(right.displayName);
}

/** Favorites and recents first (deduplicated from the lists below), then one section per key. */
export function buildSections(
  models: readonly PickerModel[],
  options: { query: string; favorites: readonly string[]; recents: readonly string[] },
): PickerSection[] {
  const visible = searchModels(models, options.query, Number.POSITIVE_INFINITY);
  const byKey = new Map(visible.map((model) => [model.key, model]));
  const pinned = new Set<string>();
  const sections: PickerSection[] = [];

  const pin = (id: string, label: string, keys: readonly string[], limit: number) => {
    const picked: PickerModel[] = [];
    for (const key of keys) {
      const model = byKey.get(key);
      if (model && !pinned.has(key)) {
        picked.push(model);
        pinned.add(key);
        if (picked.length >= limit) break;
      }
    }
    if (picked.length) sections.push({ id, label, models: picked });
  };
  pin("favorites", "Favorites", options.favorites, Number.POSITIVE_INFINITY);
  pin("recent", "Recent", options.recents, RECENT_LIMIT);

  const rest = new Map<string, PickerSection>();
  for (const model of visible) {
    if (pinned.has(model.key)) continue;
    let section = rest.get(model.credentialId);
    if (!section) {
      section = {
        id: model.credentialId,
        label: `${model.providerLabel} · ${model.credentialLabel}`,
        models: [],
      };
      rest.set(model.credentialId, section);
    }
    section.models.push(model);
  }
  let shown = 0;
  for (const section of rest.values()) {
    section.models.sort(newestFirst);
    const room = Math.max(0, SEARCH_RESULT_LIMIT - shown);
    section.models = section.models.slice(0, room);
    shown += section.models.length;
    if (section.models.length) sections.push(section);
  }
  return sections;
}

export function pushRecent(recents: readonly string[], key: string): string[] {
  return [key, ...recents.filter((item) => item !== key)].slice(0, RECENT_LIMIT);
}

export function toggleFavorite(favorites: readonly string[], key: string): string[] {
  return favorites.includes(key) ? favorites.filter((item) => item !== key) : [...favorites, key];
}
