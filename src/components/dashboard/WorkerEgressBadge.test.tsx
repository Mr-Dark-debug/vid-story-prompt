import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/services/worker/server", () => ({
  getWorkerEgressHealth: vi.fn(),
}));

import { WorkerEgressBadge } from "./WorkerEgressBadge";

describe("WorkerEgressBadge", () => {
  it.each([
    ["healthy", "Healthy"],
    ["degraded", "Degraded"],
    ["blocked", "Blocked"],
    ["unknown", "Unavailable"],
  ] as const)("renders the %s state with text, not color alone", (status, label) => {
    render(
      <WorkerEgressBadge
        health={{ checkedAt: null, message: `${label} detail`, status }}
      />,
    );
    expect(screen.getByRole("status", { name: `Source access: ${label}` })).toHaveTextContent(
      `Source access: ${label}`,
    );
  });

  it("never renders operator URLs or egress addresses", () => {
    const { container } = render(
      <WorkerEgressBadge
        health={{
          checkedAt: "2026-07-18T20:00:00.000Z",
          message: "Automatic source access is available.",
          status: "healthy",
        }}
      />,
    );
    expect(container).not.toHaveTextContent(/203\.0\.113|internal:8080/i);
    expect(container).not.toHaveTextContent(/warp|cobalt|proxy|adapter|egress/i);
  });
});
