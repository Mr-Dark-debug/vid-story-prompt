import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MotionPreview } from "./motion-preview";

const source =
  "<html><body><script>window.DURATION = 2; window.seek = async function(t) {};</script></body></html>";
const spec = {
  width: 1280,
  height: 720,
  durationSeconds: 2,
  aspect: "16:9" as const,
  fps: 30 as const,
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});
describe("MotionPreview", () => {
  it("requires an explicit action and creates a scripts-only opaque iframe", () => {
    const { container } = render(<MotionPreview source={source} spec={spec} />);
    expect(container.querySelector("iframe")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Load preview" }));
    const frame = screen.getByTitle("Isolated motion scene");
    expect(frame).toHaveAttribute("sandbox", "allow-scripts");
    expect(frame).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(frame.getAttribute("srcdoc")).toContain("connect-src 'none'");
    expect(screen.getByRole("button", { name: "Play preview" })).toBeDisabled();
    expect(screen.getByText(/Reduced motion is enabled/)).toBeInTheDocument();
  });
  it("never inserts lint-rejected source into an iframe", () => {
    const { container } = render(
      <MotionPreview
        source={source.replace("window.DURATION", "fetch('https://example.org'); window.DURATION")}
        spec={spec}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Preview blocked");
    expect(container.querySelector("iframe")).toBeNull();
  });
});
