import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocalRelayRecovery } from "./local-relay-recovery";

const listRelayDevices = vi.fn();

vi.mock("@/services/acquisition/relay.server", () => ({
  createRelayPairing: vi.fn(),
  listRelayDevices: (...args: unknown[]) => listRelayDevices(...args),
  revokeRelayDevice: vi.fn(),
  startLocalRelay: vi.fn(),
}));

describe("LocalRelayRecovery", () => {
  beforeEach(() => listRelayDevices.mockResolvedValue([]));

  it("explains the asynchronous free helper and local-only cookie boundary", async () => {
    render(<LocalRelayRecovery jobId="2c0c70a6-99ad-4b2d-a463-997641803126" onQueued={vi.fn()} />);
    expect(await screen.findByText("Pair the free helper")).toBeInTheDocument();
    expect(screen.getByText(/runs asynchronously/i)).toBeInTheDocument();
    expect(screen.getByText(/Cookies are never uploaded to Vidrial/i)).toBeInTheDocument();
    expect(screen.getByText(/Private, paid, DRM/i)).toBeInTheDocument();
  });

  it("shows an active paired device without horizontal-width assumptions", async () => {
    listRelayDevices.mockResolvedValue([
      {
        id: "4810a059-74b2-42ef-bb37-71802dd2ac0e",
        display_name: "My laptop",
        helper_version: "0.1.0",
        status: "active",
        last_seen_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      },
    ]);
    const { container } = render(
      <LocalRelayRecovery jobId="2c0c70a6-99ad-4b2d-a463-997641803126" onQueued={vi.fn()} />,
    );
    expect(await screen.findByText("Start local recovery")).toBeInTheDocument();
    expect(container.querySelector(".min-w-0")).toBeTruthy();
  });
});
