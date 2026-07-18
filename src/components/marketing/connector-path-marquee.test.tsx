import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CONNECTOR_REGISTRY } from "@/domain/connectors/registry";
import { ConnectorPathMarquee } from "./connector-path-marquee";

afterEach(cleanup);

describe("ConnectorPathMarquee", () => {
  it("renders two complete connector rows moving in opposite directions", () => {
    const { container } = render(<ConnectorPathMarquee />);
    const expectedIds = CONNECTOR_REGISTRY.filter(
      (connector) =>
        connector.availability !== "coming_soon" &&
        connector.id !== "upload" &&
        connector.id !== "direct_link" &&
        connector.id !== "other",
    ).map((connector) => connector.id);
    const rows = Array.from(container.querySelectorAll<HTMLElement>("[data-marquee-row]"));

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.dataset.marqueeDirection)).toEqual(["normal", "reverse"]);
    expect(rows.map((row) => row.dataset.marqueePath)).toEqual(["M-120 56H1320", "M-120 56H1320"]);
    expect(rows[1]).toHaveAttribute("aria-hidden", "true");

    for (const row of rows) {
      const renderedIds = Array.from(row.querySelectorAll<HTMLElement>("[data-connector-id]")).map(
        (item) => item.dataset.connectorId,
      );

      expect(renderedIds).toEqual([...expectedIds, ...expectedIds]);
      expect(renderedIds).toContain("youtube");
      expect(renderedIds).toContain("google_drive");
      expect(renderedIds).not.toContain("upload");
    }

    const marquee = screen.getByTestId("connector-path-marquee");
    expect(marquee).toHaveClass("w-[100dvw]");
    expect(marquee.style.maskImage).toContain("transparent 0%");
    expect(marquee.style.maskImage).toContain("to bottom");
  });
});
