import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.SUPABASE_URL = "https://worker-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "worker-test-service-role-key-long-enough";
});
import { TaskFailure } from "../domain/types.js";
import {
  classifyYouTubeDownloadFailure,
  classifyYouTubeExecutionFailure,
  readYouTubeSourceSection,
  selectYouTubeDownloadStrategy,
} from "./youtube-download.js";

describe("YouTube download policy", () => {
  it.each([
    ["Sign in to confirm you’re not a bot", "provider_auth_challenge", true],
    ["ERROR: HTTP Error 403: Forbidden", "provider_auth_challenge", true],
    ["This video is age-restricted", "video_age_restricted", false],
    ["Private video", "video_private", false],
    ["HTTP Error 429: Too Many Requests", "provider_rate_limited", true],
    ["HTTP Error 503: Service Unavailable", "provider_temporary_failure", true],
    ["The operation timed out", "provider_temporary_failure", true],
    ["Video unavailable", "video_unavailable", false],
  ])("classifies %s", (message, code, retryable) => {
    expect(classifyYouTubeDownloadFailure(message)).toMatchObject({ code, retryable });
  });

  it("rotates only supported fixed player strategies", () => {
    expect([1, 2, 3, 4, 5].map((attempt) => selectYouTubeDownloadStrategy(attempt, true))).toEqual([
      "standard",
      "mweb-pot",
      "web-embedded",
      "android-vr",
      "mweb-pot",
    ]);
    expect(selectYouTubeDownloadStrategy(2, false)).toBe("web-safari");
  });

  it("reads one exact validated partial section", () => {
    expect(
      readYouTubeSourceSection({ sourceSection: { startSeconds: 83, endSeconds: 130 } }),
    ).toEqual({ startSeconds: 83, endSeconds: 130 });
  });

  it.each([
    { startSeconds: -1, endSeconds: 30 },
    { startSeconds: 30, endSeconds: 30 },
    { startSeconds: 40, endSeconds: 30 },
    { startSeconds: Number.NaN, endSeconds: 30 },
  ])("rejects invalid source section $startSeconds-$endSeconds", (section) => {
    expect(() => readYouTubeSourceSection({ sourceSection: section })).toThrow(TaskFailure);
  });

  it("rejects malformed task source section input", () => {
    expect(() => readYouTubeSourceSection({ sourceSection: "0-30" })).toThrow(TaskFailure);
    expect(readYouTubeSourceSection({})).toBeUndefined();
  });

  it("distinguishes terminal media limits from transient provider failures", () => {
    expect(
      classifyYouTubeExecutionFailure("ERROR: File is larger than max-filesize. Aborting."),
    ).toMatchObject({ code: "file_too_large", retryable: false });
    expect(classifyYouTubeExecutionFailure("ERROR: Sign in to confirm you’re not a bot")).toMatchObject(
      { code: "provider_auth_challenge", retryable: true },
    );
  });
});
