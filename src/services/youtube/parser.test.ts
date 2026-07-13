import { describe, expect, it } from "vitest";
import { parseIsoDuration, parseYouTubeVideoId, YouTubeUrlError } from "./parser";
describe("YouTube URL parsing", () => {
  it.each([
    ["https://youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?t=10", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtube.com/live/dQw4w9WgXcQ?feature=share", "dQw4w9WgXcQ"],
    ["https://youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
  ])("extracts %s", (url, id) => expect(parseYouTubeVideoId(url)).toBe(id));
  it.each([
    "https://youtube.com/channel/UC123",
    "https://youtube.com/results?search_query=test",
    "https://youtube.com/playlist?list=PL123",
    "https://example.com/watch?v=dQw4w9WgXcQ",
    "not a url",
    "https://youtu.be/bad",
  ])("rejects %s", (url) => expect(() => parseYouTubeVideoId(url)).toThrow(YouTubeUrlError));
  it("parses ISO durations", () => expect(parseIsoDuration("PT1H2M3S")).toBe(3723));
});
