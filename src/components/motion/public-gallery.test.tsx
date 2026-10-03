// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { officialMotionPrompts } from "@/services/motion/catalog";
import { MotionVideo } from "./public-gallery";

vi.mock("@/services/motion/server", () => ({
  listMotionPrompts: vi.fn(),
  recordMotionPromptEvent: vi.fn(),
  reportMotionPrompt: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe("public motion preview", () => {
  it("does not fabricate a playable preview for an unrendered example", () => {
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    render(<MotionVideo prompt={{ ...officialMotionPrompts[0], previewUrl: null }} />);
    expect(screen.getByText(/Preview not yet rendered/)).toBeTruthy();
    expect(document.querySelector("video")).toBeNull();
  });
  it("shows manual controls and avoids autoplay for reduced-motion users", () => {
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    render(<MotionVideo prompt={{ ...officialMotionPrompts[0], previewUrl: "/verified.mp4" }} />);
    const video = screen.getByLabelText(/original authored demo/) as HTMLVideoElement;
    expect(video.controls).toBe(true);
    expect(video.autoplay).toBe(false);
    expect(video.preload).toBe("none");
  });
});
