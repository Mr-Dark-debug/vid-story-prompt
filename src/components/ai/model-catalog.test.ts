import { describe, expect, it } from "vitest";
import type { NormalizedModel } from "@/domain/ai/types";
import type { AiModelGroup } from "@/services/ai/server";
import {
  SEARCH_RESULT_LIMIT,
  buildSections,
  estimateCost,
  findPricing,
  capabilityChips,
  flattenGroups,
  formatContext,
  modelKey,
  parseModelKey,
  priceHint,
  pushRecent,
  searchModels,
  toggleFavorite,
} from "./model-catalog";

const model = (
  providerId: string,
  modelId: string,
  extra: Partial<NormalizedModel> = {},
): NormalizedModel => ({
  providerId,
  modelId,
  displayName: modelId,
  family: "generic",
  contextWindow: null,
  maxOutput: null,
  supportsVision: false,
  supportsJsonSchema: false,
  supportsStreaming: true,
  ...extra,
});

const groups: AiModelGroup[] = [
  {
    credentialId: "c-claude",
    providerId: "anthropic",
    label: "Personal",
    status: "active",
    fetchedAt: "2026-10-03T00:00:00Z",
    models: [
      model("anthropic", "claude-opus-5", {
        displayName: "Claude Opus 5",
        family: "anthropic",
        contextWindow: 1_000_000,
        supportsVision: true,
        supportsJsonSchema: true,
        createdAt: "2026-07-24T00:00:00Z",
      }),
      model("anthropic", "claude-haiku-4-5", {
        displayName: "Claude Haiku 4.5",
        family: "anthropic",
        createdAt: "2025-10-01T00:00:00Z",
      }),
    ],
  },
  {
    credentialId: "c-or",
    providerId: "openrouter",
    label: "Router",
    status: "active",
    fetchedAt: "2026-10-03T00:00:00Z",
    models: [
      model("openrouter", "meta-llama/llama-3.3-70b", {
        displayName: "Meta: Llama 3.3 70B",
        family: "meta",
        pricing: { inputPerMillion: 0.1, outputPerMillion: 0.3 },
      }),
    ],
  },
  {
    credentialId: "c-dead",
    providerId: "openai",
    label: "Dead",
    status: "invalid",
    fetchedAt: "x",
    models: [model("openai", "gpt-4o")],
  },
  {
    credentialId: "c-gone",
    providerId: "openai",
    label: "Gone",
    status: "revoked",
    fetchedAt: "x",
    models: [model("openai", "gpt-4.1")],
  },
];

describe("model catalog", () => {
  it("only offers models from active connections", () => {
    const flat = flattenGroups(groups);
    expect(flat.map((m) => m.modelId)).toEqual([
      "claude-opus-5",
      "claude-haiku-4-5",
      "meta-llama/llama-3.3-70b",
    ]);
    expect(flat[0]).toMatchObject({ key: "c-claude::claude-opus-5", providerLabel: "Anthropic" });
  });

  it("round-trips model keys, including ids that contain slashes and colons", () => {
    const key = modelKey("c1", "meta-llama/llama-3.3-70b:free");
    expect(parseModelKey(key)).toEqual({
      credentialId: "c1",
      modelId: "meta-llama/llama-3.3-70b:free",
    });
    expect(parseModelKey("nonsense")).toBeNull();
    expect(parseModelKey("c1::")).toBeNull();
  });

  it("formats context windows and never invents prices", () => {
    expect(formatContext(1_000_000)).toBe("1M");
    expect(formatContext(1_048_576)).toBe("1M");
    expect(formatContext(131_072)).toBe("131K");
    expect(formatContext(null)).toBeNull();
    expect(priceHint({ inputPerMillion: 3, outputPerMillion: 15 })).toBe(
      "$3 in · $15 out / 1M tokens",
    );
    expect(priceHint({ inputPerMillion: 0.1, outputPerMillion: 0.3 })).toBe(
      "$0.1 in · $0.3 out / 1M tokens",
    );
    expect(priceHint({ inputPerMillion: 0, outputPerMillion: 0 })).toBe("Free");
    expect(priceHint({ inputPerMillion: 1, outputPerMillion: null })).toBeNull();
    expect(priceHint(undefined)).toBeNull();
  });

  it("derives capability chips from metadata only", () => {
    expect(
      capabilityChips(model("x", "y", { supportsVision: true, supportsJsonSchema: true })),
    ).toEqual(["Vision", "JSON"]);
    expect(capabilityChips(model("x", "y"))).toEqual([]);
  });

  it("searches name, id, provider and maker with every term required", () => {
    const flat = flattenGroups(groups);
    expect(searchModels(flat, "opus").map((m) => m.modelId)).toEqual(["claude-opus-5"]);
    expect(searchModels(flat, "llama anthropic").length).toBe(0);
    expect(searchModels(flat, "openrouter llama").map((m) => m.modelId)).toEqual([
      "meta-llama/llama-3.3-70b",
    ]);
    expect(searchModels(flat, "META").map((m) => m.modelId)).toEqual(["meta-llama/llama-3.3-70b"]);
    expect(searchModels(flat, "  ").length).toBe(3);
  });

  it("pins favorites then recents without duplicating them below", () => {
    const flat = flattenGroups(groups);
    const sections = buildSections(flat, {
      query: "",
      favorites: ["c-or::meta-llama/llama-3.3-70b"],
      recents: ["c-or::meta-llama/llama-3.3-70b", "c-claude::claude-haiku-4-5", "gone::missing"],
    });
    expect(sections.map((s) => s.id)).toEqual(["favorites", "recent", "c-claude"]);
    expect(sections[1].models.map((m) => m.modelId)).toEqual(["claude-haiku-4-5"]);
    expect(sections[2].models.map((m) => m.modelId)).toEqual(["claude-opus-5"]);
    expect(sections[2].label).toBe("Anthropic · Personal");
  });

  it("orders each provider section newest first and caps total results", () => {
    const many = Array.from({ length: 400 }, (_, index) =>
      model("openrouter", `vendor/model-${index}`, { displayName: `Model ${index}` }),
    );
    const flat = flattenGroups([
      {
        credentialId: "c",
        providerId: "openrouter",
        label: "R",
        status: "active",
        fetchedAt: "x",
        models: many,
      },
    ]);
    const sections = buildSections(flat, { query: "", favorites: [], recents: [] });
    expect(sections[0].models).toHaveLength(SEARCH_RESULT_LIMIT);
    const [first] = buildSections(flattenGroups(groups), {
      query: "claude",
      favorites: [],
      recents: [],
    });
    expect(first.models.map((m) => m.modelId)).toEqual(["claude-opus-5", "claude-haiku-4-5"]);
  });

  it("keeps a bounded, deduplicated recent list and toggles favorites", () => {
    let recents: string[] = [];
    for (const key of ["a", "b", "c", "d", "e", "f", "a"]) recents = pushRecent(recents, key);
    expect(recents).toEqual(["a", "f", "e", "d", "c"]);
    expect(toggleFavorite(["x"], "y")).toEqual(["x", "y"]);
    expect(toggleFavorite(["x", "y"], "x")).toEqual(["y"]);
  });
});

describe("cost estimates", () => {
  const pricing = { inputPerMillion: 3, outputPerMillion: 15 };
  it("estimates only from published pricing and reported usage", () => {
    expect(estimateCost(pricing, { inputTokens: 1_000, outputTokens: 500 })).toBe("≈ $0.0105");
    expect(estimateCost(pricing, { inputTokens: 1_000_000, outputTokens: 1_000_000 })).toBe(
      "≈ $18.00",
    );
    expect(estimateCost(undefined, { inputTokens: 1, outputTokens: 1 })).toBeNull();
    expect(estimateCost(pricing, { inputTokens: null, outputTokens: 5 })).toBeNull();
    expect(
      estimateCost(
        { inputPerMillion: null, outputPerMillion: 1 },
        { inputTokens: 1, outputTokens: 1 },
      ),
    ).toBeNull();
    expect(
      estimateCost(
        { inputPerMillion: 0, outputPerMillion: 0 },
        { inputTokens: 10, outputTokens: 10 },
      ),
    ).toBe("Free");
    expect(estimateCost(pricing, { inputTokens: 1, outputTokens: 1 })).toBe("< $0.0001");
  });

  it("finds pricing by provider and model, never across providers", () => {
    expect(findPricing(groups, "openrouter", "meta-llama/llama-3.3-70b")).toEqual({
      inputPerMillion: 0.1,
      outputPerMillion: 0.3,
    });
    expect(findPricing(groups, "anthropic", "claude-opus-5")).toBeUndefined();
    expect(findPricing(groups, "openai", "meta-llama/llama-3.3-70b")).toBeUndefined();
    expect(findPricing(groups, null, "x")).toBeUndefined();
  });
});
