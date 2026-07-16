import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CONNECTOR_REGISTRY } from "@/domain/connectors/registry";
import { ConnectorIcon } from "./connector-icon";

const semanticConnectorIds = new Set([
  "local_upload",
  "direct_url",
  "ftp",
  "sftp",
  "webdav",
  "rest_api",
  "webhooks",
  "other",
]);

describe("ConnectorIcon", () => {
  it("uses a provider mark for every branded connector", () => {
    const { container } = render(
      <>
        {CONNECTOR_REGISTRY.map((connector) => (
          <ConnectorIcon key={connector.id} connectorId={connector.id} icon={connector.icon} />
        ))}
      </>,
    );

    for (const connector of CONNECTOR_REGISTRY) {
      if (semanticConnectorIds.has(connector.id)) continue;
      expect(
        container.querySelector(`[data-connector-icon="${connector.id}"]`),
        `${connector.label} should render its provider mark`,
      ).not.toBeNull();
    }
  });
});
