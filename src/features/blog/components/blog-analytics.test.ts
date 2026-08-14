import { beforeEach, describe, expect, it, vi } from "vitest";
import { configureAnalytics } from "@/services/analytics";
import { hasAnalyticsConsent, sanitizeBlogProperties, trackBlogEvent } from "./blog-analytics";

describe("blog analytics", () => {
  const track = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    track.mockReset();
    configureAnalytics({ track });
  });

  it("treats missing or malformed consent as declined", () => {
    expect(hasAnalyticsConsent(localStorage)).toBe(false);
    localStorage.setItem("vidrial.consent.v1", "not-json");
    expect(hasAnalyticsConsent(localStorage)).toBe(false);
  });

  it("sends only after analytics consent", () => {
    trackBlogEvent("blog_view", { slug: "article" });
    expect(track).not.toHaveBeenCalled();

    localStorage.setItem(
      "vidrial.consent.v1",
      JSON.stringify({ necessary: true, analytics: true, marketing: false }),
    );
    trackBlogEvent("blog_view", { slug: "article", category: "Captions" });
    expect(track).toHaveBeenCalledWith("blog_view", {
      slug: "article",
      category: "Captions",
    });
  });

  it("drops sensitive and unknown runtime properties", () => {
    expect(
      sanitizeBlogProperties({
        slug: "article",
        category: "Captions",
        articleBody: "private draft copy",
        email: "reader@example.com",
        sourceUrl: "https://private.example/source",
        resultCount: 99_999,
      }),
    ).toEqual({ slug: "article", category: "Captions", resultCount: 10_000 });
  });
});
