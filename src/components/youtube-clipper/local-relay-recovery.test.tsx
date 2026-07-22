import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocalRelayRecovery } from "./local-relay-recovery";

const listRelayDevices = vi.fn();
const createRelayPairing = vi.fn();
const revokeRelayDevice = vi.fn();

vi.mock("@/services/acquisition/relay.server", () => ({
  createRelayPairing: (...args: unknown[]) => createRelayPairing(...args),
  listRelayDevices: (...args: unknown[]) => listRelayDevices(...args),
  revokeRelayDevice: (...args: unknown[]) => revokeRelayDevice(...args),
  startLocalRelay: vi.fn(),
}));

describe("LocalRelayRecovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listRelayDevices.mockResolvedValue([]);
  });

  it("explains the asynchronous free helper and local-only cookie boundary", async () => {
    render(<LocalRelayRecovery jobId="2c0c70a6-99ad-4b2d-a463-997641803126" onQueued={vi.fn()} />);
    expect(await screen.findByText("Pair a device")).toBeInTheDocument();
    expect(screen.getByText(/keeps working after you leave/i)).toBeInTheDocument();
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

  it("copies a complete short-lived pairing command", async () => {
    createRelayPairing.mockResolvedValue({ pairingToken: "pair.challenge" });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(<LocalRelayRecovery jobId="2c0c70a6-99ad-4b2d-a463-997641803126" onQueued={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: "Pair a device" }));
    fireEvent.click(await screen.findByRole("button", { name: "Copy setup command" }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        expect.stringMatching(
          /^vidrial-relay pair --server https?:\/\/[^ ]+ --token pair\.challenge$/,
        ),
      ),
    );
  });

  it("confirms before revoking a paired device", async () => {
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
    render(<LocalRelayRecovery jobId="2c0c70a6-99ad-4b2d-a463-997641803126" onQueued={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: "Revoke" }));

    expect(await screen.findByText("Revoke My laptop?")).toBeInTheDocument();
    expect(revokeRelayDevice).not.toHaveBeenCalled();
  });
});
