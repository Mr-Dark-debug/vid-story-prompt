import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JobStatusBadge } from "./job-status-badge";

describe("JobStatusBadge", () => {
  it.each([
    ["ready", "Ready", "success"],
    ["failed", "Failed", "danger"],
    ["cancelled", "Cancelled", "neutral"],
    ["queued", "Queued", "info"],
  ])("renders %s semantically", (status, label, tone) => {
    render(<JobStatusBadge status={status} />);
    expect(screen.getByText(label)).toHaveAttribute("data-tone", tone);
  });
});
