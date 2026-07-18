import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CONNECTOR_REGISTRY } from "@/domain/connectors/registry";
import { ConnectorSettingsOverview } from "./connector-settings-overview";

afterEach(cleanup);

describe("ConnectorSettingsOverview", () => {
  it("renders every registry connector exactly once and opens its single settings entry point", () => {
    const onOpen = vi.fn();
    const catalog = CONNECTOR_REGISTRY.map((connector) => ({
      ...connector,
      configured: connector.availability === "available",
      connected: connector.id === "youtube",
      executable: connector.availability === "available",
    }));
    const { container } = render(<ConnectorSettingsOverview catalog={catalog} onOpen={onOpen} />);
    const triggers = Array.from(
      container.querySelectorAll<HTMLElement>("[data-connector-trigger]"),
    );

    expect(triggers).toHaveLength(CONNECTOR_REGISTRY.length);
    expect(new Set(triggers.map((trigger) => trigger.dataset.connectorTrigger)).size).toBe(
      CONNECTOR_REGISTRY.length,
    );
    for (const id of ["youtube", "tiktok", "instagram"]) {
      expect(triggers.filter((trigger) => trigger.dataset.connectorTrigger === id)).toHaveLength(1);
    }

    fireEvent.click(triggers.find((trigger) => trigger.dataset.connectorTrigger === "youtube")!);
    expect(onOpen).toHaveBeenCalledWith("youtube");
  });
});
