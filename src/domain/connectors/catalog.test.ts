import { describe, expect, it } from "vitest";
import { CONNECTOR_REGISTRY } from "./registry";
import { filterConnectors, groupConnectors, orderWithRecent, searchConnectors } from "./catalog";
import { detectUrlSource } from "./url-resolver";

describe("connector catalog", () => {
  it("has unique ids and honest executable capabilities", () => {
    expect(new Set(CONNECTOR_REGISTRY.map((item) => item.id)).size).toBe(CONNECTOR_REGISTRY.length);
    expect(CONNECTOR_REGISTRY.find((item) => item.id === "youtube")).toMatchObject({
      availability: "available",
      requiresOriginalSource: false,
      capabilities: expect.arrayContaining(["metadata", "download_original"]),
    });
    expect(CONNECTOR_REGISTRY.find((item) => item.id === "tiktok")).toMatchObject({
      availability: "coming_soon",
      capabilities: [],
    });
  });

  it("groups and searches by names, category labels, and aliases", () => {
    expect(
      groupConnectors(CONNECTOR_REGISTRY).find((group) => group.category === "cloud_storage")
        ?.connectors.length,
    ).toBeGreaterThan(5);
    expect(searchConnectors(CONNECTOR_REGISTRY, "shared with me").map((item) => item.id)).toContain(
      "google_drive",
    );
    expect(searchConnectors(CONNECTOR_REGISTRY, "podcast audio").map((item) => item.id)).toContain(
      "rss",
    );
    expect(
      filterConnectors(CONNECTOR_REGISTRY, "coming_soon").every(
        (item) => item.availability === "coming_soon",
      ),
    ).toBe(true);
  });

  it("orders recent sources before alphabetical fallback", () => {
    expect(
      orderWithRecent(CONNECTOR_REGISTRY.slice(0, 5), ["rss", "youtube"])
        .slice(0, 2)
        .map((item) => item.id),
    ).toEqual(["rss", "youtube"]);
  });

  it.each([
    ["https://youtu.be/dQw4w9WgXcQ", "youtube", "platform"],
    ["https://drive.google.com/file/d/abc/view", "google_drive", "platform"],
    ["https://cdn.example.com/video.mp4", "direct_url", "direct_media"],
    ["https://example.com/feed.xml", "rss", "feed"],
    ["https://example.com/watch/123", "other", "unknown"],
  ])("detects %s without downloading", (url, connectorId, kind) => {
    expect(detectUrlSource(url)).toMatchObject({ connectorId, kind, valid: true });
  });

  it("rejects non-HTTPS and malformed URLs", () => {
    expect(detectUrlSource("http://example.com/video.mp4").valid).toBe(false);
    expect(detectUrlSource("not a url").valid).toBe(false);
  });
});
