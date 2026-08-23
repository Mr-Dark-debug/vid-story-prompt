import { describe, expect, it } from "vitest";
import { parseTaskCapabilities } from "./task-capabilities.js";

describe("worker task capabilities", () => {
  it("normalizes unique include and exclude lists", () => {
    expect(
      parseTaskCapabilities(
        " download_youtube_source,download_youtube_source ",
        "render_clip_preview, transcribe_chunk",
      ),
    ).toEqual({
      include: ["download_youtube_source"],
      exclude: ["render_clip_preview", "transcribe_chunk"],
    });
  });

  it("uses an unrestricted include list by default", () => {
    expect(parseTaskCapabilities(undefined, "")).toEqual({ include: null, exclude: [] });
  });

  it("rejects invalid or overlapping task types", () => {
    expect(() => parseTaskCapabilities("download-youtube", undefined)).toThrow("invalid task type");
    expect(() =>
      parseTaskCapabilities("download_youtube_source", "download_youtube_source"),
    ).toThrow("overlap");
  });
});
