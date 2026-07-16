import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.SUPABASE_URL = "https://worker-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "worker-test-service-role-key-long-enough";
});
import { TaskFailure } from "../domain/types.js";
import { buildYouTubeDownloadArgs } from "./youtube-download.js";

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
});
