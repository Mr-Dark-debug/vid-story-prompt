import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AI_FAMILIES } from "@/domain/ai/families";
import { AI_PROVIDERS } from "@/domain/ai/providers";
import { resolveProviderMark } from "@/lib/ai-provider-marks";
import { ModelLogo, ProviderLogo } from "./provider-logo";

afterEach(cleanup);

describe("ProviderLogo", () => {
  it("renders an accessible, theme-inheriting mark for a maker family", () => {
    render(<ProviderLogo family="anthropic" size={32} />);
    const logo = screen.getByRole("img", { name: "Anthropic" });
    expect(logo.querySelector("svg")).not.toBeNull();
    expect(logo.querySelector("svg")?.getAttribute("fill")).toBe("currentColor");
    expect(logo).toHaveStyle({ width: "32px", height: "32px" });
  });

  it("shows the provider's own mark and label for connection surfaces", () => {
    render(<ProviderLogo provider="openrouter" />);
    expect(screen.getByRole("img", { name: "OpenRouter" })).toHaveAttribute(
      "data-logo",
      "openrouter",
    );
  });

  it("falls back to the generic mark for an unknown family", () => {
    render(<ProviderLogo family="never-heard-of-it" />);
    expect(screen.getByRole("img", { name: "Other" })).toHaveAttribute("data-logo", "generic");
  });

  it("can be decorative when the name is printed alongside", () => {
    const { container } = render(<ProviderLogo family="openai" decorative />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(container.querySelector("[aria-hidden='true']")).not.toBeNull();
  });

  it("has a bundled mark for every registry logo key", () => {
    for (const key of [
      ...AI_PROVIDERS.map((provider) => provider.logoKey),
      ...Object.values(AI_FAMILIES).map((family) => family.logoKey),
    ]) {
      expect(resolveProviderMark(key), key).toContain("<svg");
    }
  });

  it("badges a hosted model with its serving provider, but not a first-party one", () => {
    const hosted = render(<ModelLogo family="anthropic" provider="openrouter" />);
    expect(hosted.container.querySelectorAll("[role='img']")).toHaveLength(2);
    cleanup();
    const firstParty = render(<ModelLogo family="anthropic" provider="anthropic" />);
    expect(firstParty.container.querySelectorAll("[role='img']")).toHaveLength(1);
  });
});
