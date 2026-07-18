import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.SUPABASE_URL = "https://worker-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "worker-test-service-role-key-long-enough";
});
import { TaskFailure } from "../domain/types.js";
import {
  buildYouTubeDownloadArgs,
  classifyYouTubeDownloadFailure,
} from "./youtube-download.js";

describe("YouTube download command", () => {
  it("builds one fixed, bounded yt-dlp invocation", () => {
    const args = buildYouTubeDownloadArgs("dQw4w9WgXcQ", "/tmp/vidrial/task", 120);

    expect(args.at(-1)).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(args).toEqual(
      expect.arrayContaining([
        "--no-playlist",
        "--no-cookies",
        "--no-cache-dir",
        "--ignore-config",
        "--js-runtimes",
        "node",
        "--max-filesize",
        "--match-filters",
        "!is_live & duration <= 131",
        "--print",
        "after_move:filepath",
      ]),
    );
    expect(Number(args[args.indexOf("--max-filesize") + 1])).toBeGreaterThan(0);
    expect(args[args.indexOf("-o") + 1]).toMatch(/yt-source\.%\(ext\)s$/);
    expect(args).not.toContain("--max-downloads");
    expect(args.join(" ")).not.toMatch(/cookiefile|proxy|username|password/i);
  });

  it("rejects malformed ids and invalid duration bounds before spawning", () => {
    expect(() => buildYouTubeDownloadArgs("not-a-video-id", "/tmp/task", 120)).toThrow(TaskFailure);
    expect(() => buildYouTubeDownloadArgs("dQw4w9WgXcQ", "/tmp/task", 0)).toThrow(TaskFailure);
  });

  it.each([
    ["Sign in to confirm you’re not a bot", "provider_auth_challenge", true],
    ["This video is age-restricted", "video_age_restricted", false],
    ["Private video", "video_private", false],
    ["HTTP Error 429: Too Many Requests", "provider_rate_limited", true],
    ["HTTP Error 503: Service Unavailable", "provider_temporary_failure", true],
    ["The operation timed out", "provider_temporary_failure", true],
    ["Video unavailable", "video_unavailable", false],
  ])("classifies %s", (message, code, retryable) => {
    expect(classifyYouTubeDownloadFailure(message)).toMatchObject({ code, retryable });
  });

  it("uses only fixed fallback extractor strategies", () => {
    const safariArgs = buildYouTubeDownloadArgs(
      "dQw4w9WgXcQ",
      "/tmp/vidrial/task",
      120,
      "web-safari",
    );
    expect(safariArgs).toEqual(
      expect.arrayContaining(["--extractor-args", "youtube:player_client=web_safari"]),
    );

    const potArgs = buildYouTubeDownloadArgs(
      "dQw4w9WgXcQ",
      "/tmp/vidrial/task",
      120,
      "mweb-pot",
      "http://127.0.0.1:4416",
    );
    expect(potArgs).toEqual(
      expect.arrayContaining([
        "youtube:player_client=mweb",
        "youtubepot-bgutilhttp:base_url=http://127.0.0.1:4416",
      ]),
    );
    expect(potArgs.join(" ")).not.toMatch(/cookiefile|username|password/i);
  });
});
