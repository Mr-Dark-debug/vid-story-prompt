import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CONNECTOR_REGISTRY } from "@/domain/connectors/registry";
import { ConnectorPathMarquee } from "./connector-path-marquee";

afterEach(cleanup);

describe("ConnectorPathMarquee", () => {
  it("renders the complete active connector set from the registry", () => {
    const { container } = render(<ConnectorPathMarquee />);
    const renderedIds = Array.from(
      container.querySelectorAll<HTMLElement>("[data-connector-id]"),
    ).map((item) => item.dataset.connectorId);
    const expectedIds = CONNECTOR_REGISTRY.filter(
      (connector) =>
        connector.availability !== "coming_soon" &&
        connector.id !== "upload" &&
        connector.id !== "direct_link" &&
        connector.id !== "other",
    ).map((connector) => connector.id);

    expect(renderedIds).toEqual([...expectedIds, ...expectedIds]);
    expect(renderedIds).toContain("youtube");
    expect(renderedIds).toContain("google_drive");
    expect(renderedIds).not.toContain("upload");

    const marquee = screen.getByTestId("connector-path-marquee");
    expect(marquee).toHaveClass("w-[100dvw]");
    expect(marquee.style.maskImage).toContain("transparent 0%");
    expect(marquee.style.maskImage).toContain("to bottom");
  });
});
