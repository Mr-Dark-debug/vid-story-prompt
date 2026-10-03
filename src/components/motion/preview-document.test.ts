import { describe, expect, it } from "vitest";
import { createMotionPreviewDocument, isMotionPreviewMessage } from "./preview-document";
import { MOTION_CSP } from "@/domain/motion/contract";

const scene =
  "<html><body><canvas></canvas><script>window.DURATION = 2; window.seek = async function(t) {};</script></body></html>";
describe("motion preview isolation", () => {
  it("installs the strict CSP before scene markup and binds the bridge to parent origin", () => {
    const result = createMotionPreviewDocument(scene, "opaque-token", "https://vidrial.app");
    expect(result.indexOf(MOTION_CSP)).toBeLessThan(result.indexOf(scene));
    expect(result).toContain("event.source !== parent");
    expect(result).toContain("event.origin !== origin");
    expect(result).toContain("message.token !== token");
    expect(result).toContain("document.fonts.ready");
    expect(result).toContain("font-family:\"Manrope\"");
    expect(result).toContain("data:");
    expect(MOTION_CSP).toContain("connect-src 'none'");
    expect(MOTION_CSP).toContain("form-action 'none'");
  });
  it("escapes embedded bridge values that could terminate a script", () => {
    const token = '</script><script>alert("injected")</script>';
    const result = createMotionPreviewDocument(scene, token, "https://vidrial.app");
    expect(result).not.toContain(token);
    expect(result).toContain("\\u003c/script>");
  });
  it.each([
    "fetch('https://example.org')",
    "new XMLHttpRequest()",
    "new WebSocket('wss://example.org')",
    "import('https://example.org')",
    "navigator.sendBeacon('https://example.org')",
    "window.open('https://example.org')",
    "Date.now()",
    "Math.random()",
    "setInterval(() => {}, 100)",
  ])("refuses to construct an executable preview for %s", (attack) => {
    expect(() =>
      createMotionPreviewDocument(
        scene.replace("window.DURATION", `${attack}; window.DURATION`),
        "token",
        "https://vidrial.app",
      ),
    ).toThrow("linter");
  });
  it("accepts only opaque-origin messages from the exact iframe and token", () => {
    const source = {} as Window;
    const event = {
      source,
      origin: "null",
      data: { motionPreview: true, token: "token", type: "ready" },
    } as MessageEvent;
    expect(isMotionPreviewMessage(event, source, "token")).toBe(true);
    expect(isMotionPreviewMessage(event, {} as Window, "token")).toBe(false);
    expect(
      isMotionPreviewMessage(
        { ...event, origin: "https://vidrial.app" } as MessageEvent,
        source,
        "token",
      ),
    ).toBe(false);
    expect(isMotionPreviewMessage(event, source, "other-token")).toBe(false);
    expect(
      isMotionPreviewMessage(
        { ...event, data: { ...event.data, type: "render" } } as MessageEvent,
        source,
        "token",
      ),
    ).toBe(false);
  });
});
