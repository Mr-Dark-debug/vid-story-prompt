import { beforeEach, describe, expect, it, vi } from "vitest";
import { configureAnalytics } from "@/services/analytics";
import { CONSENT_STORAGE_KEY } from "@/services/analytics/consent";
import { sanitizeAnalyticsProperties, trackAnalyticsEvent } from "./client";

describe("privacy-safe client analytics", () => {
  const track = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    track.mockClear();
    configureAnalytics({ track });
  });

  it("keeps only allow-listed, bounded properties", () => {
    expect(
      sanitizeAnalyticsProperties({
        method: "email",
        source: "youtube",
        confirmation_required: true,
        clip_count: 900,
        email: "private@example.com",
        filename: "private.mp4",
        sourceUrl: "https://example.com/private",
        jobId: "secret",
      }),
    ).toEqual({
      method: "email",
      source: "youtube",
      confirmation_required: true,
      clip_count: 100,
    });
  });

  it("does not track before analytics consent", () => {
    trackAnalyticsEvent("pricing_viewed");
    expect(track).not.toHaveBeenCalled();
  });

  it("tracks an allow-listed event after consent", () => {
    localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({ necessary: true, analytics: true, marketing: false }),
    );
    trackAnalyticsEvent("signup_completed", {
      method: "email",
      confirmation_required: true,
      email: "private@example.com",
    });
    expect(track).toHaveBeenCalledWith("signup_completed", {
      method: "email",
      confirmation_required: true,
    });
  });
});
