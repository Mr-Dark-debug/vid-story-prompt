import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/connectors/server", () => ({
  joinConnectorWaitlist: vi.fn().mockResolvedValue({ ok: true }),
}));

import { getConnector } from "@/domain/connectors/registry";
import { joinConnectorWaitlist } from "@/services/connectors/server";
import { ComingSoonConnectorPanel } from "./coming-soon-connector-panel";

afterEach(() => cleanup());

describe("coming soon connector", () => {
  it("records interest without opening OAuth or simulating a connection", async () => {
    render(<ComingSoonConnectorPanel connector={getConnector("tiktok")!} />);
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
    expect(screen.queryByText("Connected")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Notify me" }));
    await waitFor(() =>
      expect(joinConnectorWaitlist).toHaveBeenCalledWith({ data: { connectorId: "tiktok" } }),
    );
    expect(screen.getByRole("button", { name: /on the list/i })).toBeDisabled();
  });
});
