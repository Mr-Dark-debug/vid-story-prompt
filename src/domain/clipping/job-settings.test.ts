import { describe, expect, it } from "vitest";
import { prepareClipJobSettings } from "./job-settings";
describe("Exact Cut API settings boundary", () => {
  const context = { sourceSeconds: 600, requestedClips: 1, maximumClips: 5 };
  it("canonicalizes selected ranges without accepting captions or invented AI settings", () => {
    expect(
      prepareClipJobSettings(
        {
          mode: "manual_timestamp",
          ranges: [{ label: "  Test  ", startSeconds: 30, endSeconds: 45 }],
          instruction: "must be ignored",
        },
        context,
      ),
    ).toEqual({
      mode: "manual_timestamp",
      ranges: [{ label: "Test", startSeconds: 30, endSeconds: 45 }],
      captionsRequested: false,
    });
  });
  it("validates source bounds, count agreement and timestamp precision", () => {
    for (const range of [
      { startSeconds: 30, endSeconds: 601 },
      { startSeconds: 0.0001, endSeconds: 1 },
    ])
      expect(() =>
        prepareClipJobSettings({ mode: "manual_timestamp", ranges: [range] }, context),
      ).toThrow();
    expect(() =>
      prepareClipJobSettings({ mode: "manual_timestamp", ranges: [] }, context),
    ).toThrow();
    expect(() =>
      prepareClipJobSettings(
        {
          mode: "manual_timestamp",
          ranges: [{ startSeconds: 0, endSeconds: 1 }],
          captionsRequested: true,
        },
        context,
      ),
    ).toThrow();
  });
  it("retains legacy discovery settings", () => {
    expect(prepareClipJobSettings({ instruction: "Find clear explanations" }, context)).toEqual({
      instruction: "Find clear explanations",
    });
  });
});
