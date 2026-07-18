import { describe, expect, it } from "vitest";
import { clipCandidateSchema } from "../ai/schema.js";
import { overlapRatio, selectDiverseCandidates } from "../ai/selection.js";
import { createSrt, createVtt } from "../media/captions.js";
import { renderManifestHash } from "../media/manifest.js";
import { classifyFailure, failureForTaskAttempt, nextAttempt } from "../queue/retry.js";
import { isForbiddenAddress } from "../security/addresses.js";
import { dedupeFilename, safeFilename } from "../storage/filenames.js";
import { mergeTranscriptChunks } from "../transcription/merge.js";
const candidate = (start: number, end: number, title: string) =>
  clipCandidateSchema.parse({
    startSeconds: start,
    endSeconds: end,
    title,
    hook: "Hook",
    summary: "Summary",
    topic: title,
    transcriptExcerpt: title,
    standaloneScore: 90,
    hookScore: 90,
    clarityScore: 90,
    storyScore: 90,
    relevanceScore: 90,
    overallScore: 90,
    explanation: "Complete thought",
  });
describe("worker domains", () => {
  it("validates AI candidates and duration", () => {
    expect(candidate(0, 30, "A").endSeconds).toBe(30);
    expect(() => candidate(30, 20, "bad")).toThrow();
  });
  it("deduplicates overlaps while preserving diversity", () => {
    const a = candidate(0, 30, "A"),
      b = candidate(5, 28, "B"),
      c = candidate(60, 90, "C");
    expect(overlapRatio(a, b)).toBeGreaterThan(0.5);
    expect(selectDiverseCandidates([a, b, c], 3)).toEqual([a, c]);
  });
  it("merges chunk overlaps without duplicate words", () => {
    const result = mergeTranscriptChunks([
      {
        offsetSeconds: 0,
        text: "hello world",
        words: [
          { word: "hello", start: 0, end: 0.5 },
          { word: "world", start: 0.6, end: 1 },
        ],
      },
      {
        offsetSeconds: 0.8,
        text: "world again",
        words: [
          { word: "world", start: 0, end: 0.2 },
          { word: "again", start: 0.3, end: 0.7 },
        ],
      },
    ]);
    expect(result.text).toBe("hello world again");
  });
  it("blocks private, loopback, link local, metadata and IPv6 local addresses", () => {
    for (const ip of [
      "127.0.0.1",
      "10.0.0.1",
      "172.16.1.1",
      "192.168.1.1",
      "169.254.169.254",
      "::1",
      "fd00::1",
      "fe80::1",
    ])
      expect(isForbiddenAddress(ip)).toBe(true);
    expect(isForbiddenAddress("8.8.8.8")).toBe(false);
  });
  it("sanitises and deduplicates filenames", () => {
    expect(safeFilename("../bad:<name>.mp4")).not.toMatch(new RegExp('[<>:"/\\\\|?*]'));
    const used = new Set<string>();
    expect(dedupeFilename("clip.mp4", used)).toBe("clip.mp4");
    expect(dedupeFilename("clip.mp4", used)).toBe("clip-2.mp4");
  });
  it("hashes render manifests deterministically", () =>
    expect(renderManifestHash({ b: 2, a: 1 })).toBe(renderManifestHash({ a: 1, b: 2 })));
  it("creates SRT and VTT captions", () => {
    expect(createSrt("one two three", 3)).toContain("-->");
    expect(createVtt("one two", 2)).toMatch(/^WEBVTT/);
  });
  it("classifies retries with future backoff", () => {
    expect(classifyFailure(new Error("network timeout")).retryable).toBe(true);
    expect(new Date(nextAttempt(1, 0)).getTime()).toBeGreaterThan(Date.now());
  });
  it("replaces retry copy when the final provider attempt is exhausted", () => {
    expect(
      failureForTaskAttempt(
        { attempt: 5, max_attempts: 5 },
        { code: "provider_auth_challenge", message: "Vidrial will retry.", retryable: true },
      ).message,
    ).toContain("after every protected download path");
  });
});
