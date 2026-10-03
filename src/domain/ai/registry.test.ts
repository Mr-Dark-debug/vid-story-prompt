import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AI_FAMILIES, familyFromModel, getFamily } from "./families";
import {
  AI_PROVIDERS,
  getAiProvider,
  isProviderConnectable,
  listAiProviders,
  requireAiProvider,
} from "./providers";

const assetDir = join(process.cwd(), "src", "assets", "ai-providers");

describe("AI provider registry integrity", () => {
  it("has unique ids and fixed https base URLs without credentials", () => {
    const ids = AI_PROVIDERS.map((provider) => provider.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const provider of AI_PROVIDERS) {
      const url = new URL(provider.baseUrl);
      expect(url.protocol).toBe("https:");
      expect(url.username + url.password + url.search).toBe("");
      expect(provider.baseUrl.endsWith("/")).toBe(false);
    }
  });

  it("ships the four launch providers as available and presets as beta", () => {
    expect(listAiProviders("available").map((p) => p.id)).toEqual([
      "anthropic",
      "openai",
      "google",
      "openrouter",
    ]);
    expect(
      listAiProviders("beta")
        .map((p) => p.id)
        .sort(),
    ).toEqual(["deepseek", "groq", "mistral", "together", "xai"]);
  });

  it("offers no user-supplied base URL provider", () => {
    expect(getAiProvider("custom")).toBeUndefined();
    expect(() => requireAiProvider("custom")).toThrow();
  });

  it("requires a dialect for every OpenAI-style provider and none elsewhere", () => {
    for (const provider of AI_PROVIDERS) {
      const needsDialect = provider.kind === "openai" || provider.kind === "openai_compatible";
      expect(Boolean(provider.dialect)).toBe(needsDialect);
    }
  });

  it("only treats available and beta providers as connectable", () => {
    for (const provider of AI_PROVIDERS) {
      expect(isProviderConnectable(provider)).toBe(provider.availability !== "coming_soon");
    }
  });

  it("maps every logo key used by providers and families to an asset on disk", () => {
    const files = new Set(readdirSync(assetDir).map((name) => name.replace(/\.svg$/, "")));
    for (const provider of AI_PROVIDERS) expect(files.has(provider.logoKey)).toBe(true);
    for (const family of Object.values(AI_FAMILIES)) expect(files.has(family.logoKey)).toBe(true);
    expect(existsSync(join(assetDir, "generic.svg"))).toBe(true);
  });

  it("keeps asset files free of scripts and external references", () => {
    for (const name of readdirSync(assetDir).filter((file) => file.endsWith(".svg"))) {
      const svg = readFileSync(join(assetDir, name), "utf8");
      expect(svg).not.toMatch(/<script|href=|onload|<image|foreignObject/i);
    }
  });
});

describe("model-maker families", () => {
  it("derives the family from an OpenRouter author prefix", () => {
    expect(familyFromModel("openrouter", "anthropic/claude-sonnet")).toBe("anthropic");
    expect(familyFromModel("openrouter", "meta-llama/llama-3.3-70b-instruct")).toBe("meta");
    expect(familyFromModel("openrouter", "mistralai/mixtral-8x7b")).toBe("mistral");
    expect(familyFromModel("openrouter", "x-ai/grok-4")).toBe("xai");
    expect(familyFromModel("openrouter", "someone-new/model")).toBe("generic");
  });

  it("uses the maker for first-party providers and name hints on shared hosts", () => {
    expect(familyFromModel("anthropic", "claude-opus-5")).toBe("anthropic");
    expect(familyFromModel("groq", "llama-3.3-70b-versatile")).toBe("meta");
    expect(familyFromModel("groq", "openai/gpt-oss-120b")).toBe("openai");
    expect(familyFromModel("together", "Qwen/Qwen2.5-72B")).toBe("qwen");
    expect(familyFromModel("together", "totally-unknown")).toBe("generic");
  });

  it("falls back to the generic family for unknown ids", () => {
    expect(getFamily("nope").id).toBe("generic");
    expect(getFamily(undefined).id).toBe("generic");
  });
});
