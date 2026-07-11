import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock("@/services/youtube/server", () => ({ getYouTubeMetadata: vi.fn() }));
import { YouTubeClipperPublicPage } from "./public-page";
afterEach(cleanup);
describe("public YouTube Clipper", () => {
  beforeEach(() => localStorage.clear());
  it("shows the URL form, rights language and five deterministic clips", () => {
    render(<YouTubeClipperPublicPage />);
    expect(screen.getByLabelText("YouTube video URL")).toBeInTheDocument();
    expect(screen.getByText(/Only upload or process content you own/)).toBeInTheDocument();
    expect(screen.getAllByText(/strength/i).length).toBeGreaterThanOrEqual(5);
  });
  it("updates demo selection", () => {
    render(<YouTubeClipperPublicPage />);
    expect(screen.getByText("Export 3 selected")).toBeInTheDocument();
    fireEvent.click(screen.getByText("The quiet advantage of finishing"));
    expect(screen.getByText("Export 4 selected")).toBeInTheDocument();
  });
});
