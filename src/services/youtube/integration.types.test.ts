import { describe, expect, it } from "vitest";
import { automationRuleInputSchema, publishInputSchema } from "./integration.types";

describe("YouTube integration inputs", () => {
  it("accepts an explicit private publishing request", () => {
    const result = publishInputSchema.parse({
      exportId: "11111111-1111-4111-8111-111111111111",
      youtubeChannelId: "22222222-2222-4222-8222-222222222222",
      title: "Licensed fixture",
      madeForKids: false,
      privacyStatus: "private",
      scheduledFor: null,
      idempotencyKey: "33333333-3333-4333-8333-333333333333",
    });
    expect(result.privacyStatus).toBe("private");
  });

  it("rejects oversized YouTube titles and clip counts", () => {
    expect(() =>
      publishInputSchema.parse({
        exportId: crypto.randomUUID(),
        youtubeChannelId: crypto.randomUUID(),
        title: "x".repeat(101),
        madeForKids: false,
        scheduledFor: null,
        idempotencyKey: crypto.randomUUID(),
      }),
    ).toThrow();
    expect(() =>
      automationRuleInputSchema.parse({
        enabled: true,
        sourceBehavior: "create_draft",
        requestedClipCount: 51,
        durationRange: "30-60 seconds",
        captionPreset: "Clean editorial",
        contentType: "Video",
        publishingBehavior: "do_not_publish",
        defaultPrivacy: "private",
        timezone: "UTC",
        rightsAccepted: false,
      }),
    ).toThrow();
  });
});
