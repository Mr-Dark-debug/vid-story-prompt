import { describe, expect, it } from "vitest";
import { buildLocalYtdlpArgs } from "./youtube.js";

const input = {
  videoId: "dQw4w9WgXcQ",
  directory: "/tmp/vidrial-relay",
  maximumBytes: 1_000_000,
  expectedDurationSeconds: 600,
};

describe("local yt-dlp policy", () => {
  it("is cookie-free by default and uses exact partial download", () => {
    const args = buildLocalYtdlpArgs({
      ...input,
      section: { startSeconds: 30, endSeconds: 45 },
    });
    expect(args).toContain("--no-cookies");
    expect(args).toContain("--download-sections");
    expect(args).toContain("*30-45");
    expect(args.slice(args.indexOf("--remux-video"), args.indexOf("--remux-video") + 2)).toEqual([
      "--remux-video",
      "mp4",
    ]);
    expect(args).not.toContain("--cookies");
  });

  it("uses an explicit local cookie path only when opted in", () => {
    const args = buildLocalYtdlpArgs({ ...input, cookiesPath: "./private-cookies.txt" });
    expect(args).toContain("--cookies");
    expect(args).not.toContain("--no-cookies");
    expect(args[args.indexOf("--cookies") + 1]).toMatch(/private-cookies\.txt$/);
  });

  it("rejects malformed ranges before launching a process", () => {
    expect(() =>
      buildLocalYtdlpArgs({ ...input, section: { startSeconds: 45, endSeconds: 30 } }),
    ).toThrow("Invalid source section");
  });
});
