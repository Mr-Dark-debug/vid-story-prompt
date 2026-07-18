import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.SUPABASE_URL = "https://worker-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "worker-test-service-role-key-long-enough";
});
import { TaskFailure } from "../domain/types.js";
import {
  buildYouTubeDownloadArgs,
  classifyYouTubeDownloadFailure,
  classifyYouTubeExecutionFailure,
  readYouTubeSourceSection,
  selectYouTubeDownloadStrategy,
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
        "--force-ipv4",
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
    [
      "ERROR: unable to download video data: HTTP Error 403: Forbidden",
      "provider_auth_challenge",
      true,
    ],
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

    const embeddedArgs = buildYouTubeDownloadArgs(
      "dQw4w9WgXcQ",
      "/tmp/vidrial/task",
      120,
      "web-embedded",
    );
    expect(embeddedArgs).toEqual(
      expect.arrayContaining(["--extractor-args", "youtube:player_client=web_embedded"]),
    );

    const androidArgs = buildYouTubeDownloadArgs(
      "dQw4w9WgXcQ",
      "/tmp/vidrial/task",
      120,
      "android-vr",
    );
    expect(androidArgs).toEqual(
      expect.arrayContaining(["--extractor-args", "youtube:player_client=android_vr"]),
    );
  });

  it("rotates supported clients instead of repeating one blocked path", () => {
    expect([1, 2, 3, 4, 5].map((attempt) => selectYouTubeDownloadStrategy(attempt, true))).toEqual([
      "standard",
      "mweb-pot",
      "web-embedded",
      "android-vr",
      "mweb-pot",
    ]);
    expect(selectYouTubeDownloadStrategy(2, false)).toBe("web-safari");
  });

  it("allows a server-only egress proxy while rejecting unsupported schemes", () => {
    const proxyArgs = buildYouTubeDownloadArgs(
      "dQw4w9WgXcQ",
      "/tmp/vidrial/task",
      120,
      "standard",
      undefined,
      "socks5h://proxy.internal:1080",
    );
    expect(proxyArgs).toEqual(expect.arrayContaining(["--proxy", "socks5h://proxy.internal:1080"]));
    expect(() =>
      buildYouTubeDownloadArgs(
        "dQw4w9WgXcQ",
        "/tmp/vidrial/task",
        120,
        "standard",
        undefined,
        "file:///tmp/socket",
      ),
    ).toThrow(TaskFailure);
  });

  it("uses FFmpeg section download only for an exact validated range", () => {
    const section = readYouTubeSourceSection({
      sourceSection: { startSeconds: 83, endSeconds: 130 },
    });
    const args = buildYouTubeDownloadArgs(
      "dQw4w9WgXcQ",
      "/tmp/vidrial/task",
      600,
      "standard",
      undefined,
      "http://warp.internal:8080",
      section,
    );
    expect(args).toEqual(
      expect.arrayContaining([
        "--proxy",
        "http://warp.internal:8080/",
        "--downloader",
        "ffmpeg",
        "--download-sections",
        "*83-130",
      ]),
    );
  });

  it.each([
    { startSeconds: -1, endSeconds: 30 },
    { startSeconds: 30, endSeconds: 30 },
    { startSeconds: 40, endSeconds: 30 },
    { startSeconds: 0, endSeconds: 601 },
    { startSeconds: Number.NaN, endSeconds: 30 },
  ])("rejects invalid source section $startSeconds-$endSeconds", (section) => {
    expect(() =>
      buildYouTubeDownloadArgs(
        "dQw4w9WgXcQ",
        "/tmp/vidrial/task",
        600,
        "standard",
        undefined,
        undefined,
        section,
      ),
    ).toThrow(TaskFailure);
  });

  it("rejects malformed task source section input", () => {
    expect(() => readYouTubeSourceSection({ sourceSection: "0-30" })).toThrow(TaskFailure);
    expect(readYouTubeSourceSection({})).toBeUndefined();
  });

  it("does not mistake the bounded command flag for an oversized download", () => {
    const executionOutput = [
      "Command failed with exit code 1: yt-dlp --max-filesize 2147483648",
      "ERROR: Sign in to confirm you’re not a bot",
    ].join("\n");

    expect(classifyYouTubeExecutionFailure(executionOutput)).toMatchObject({
      code: "provider_auth_challenge",
      retryable: true,
    });
    expect(
      classifyYouTubeExecutionFailure("ERROR: File is larger than max-filesize. Aborting."),
    ).toMatchObject({ code: "file_too_large", retryable: false });
  });
});
