import { describe, expect, it } from "vitest";
import {
  buildCandidateWindows,
  estimateTranscriptWords,
  fallbackCandidate,
} from "./candidates.js";

function wordsFor(sentences: string[]) {
  let cursor = 0;
  return sentences.flatMap((sentence) => {
    const words = sentence.split(" ").map((text) => {
      const word = { start: cursor, end: cursor + 0.55, text };
      cursor += 0.65;
      return word;
    });
    cursor += 1.2;
    return words;
  });
}

describe("deterministic candidate windows", () => {
  it("segments transcript pauses into bounded complete windows", () => {
    const words = wordsFor([
      "Why does latency change the product architecture completely? Because every waiting state becomes a user experience decision and the system needs honest feedback.",
      "Here is the second complete lesson with enough words to form another useful moment. It ends cleanly and explains the result.",
      "Finally we compare the tradeoffs and show how a queue keeps slow work reliable. That is the practical conclusion.",
    ]);
    const windows = buildCandidateWindows({
      durationSeconds: words.at(-1)!.end,
      instruction: "latency architecture queue",
      maximumWindows: 8,
      words,
    });
    expect(windows.length).toBeGreaterThan(0);
    expect(windows.every((window) => window.endSeconds > window.startSeconds)).toBe(true);
    expect(windows.every((window) => window.endSeconds - window.startSeconds <= 62)).toBe(true);
    expect(windows[0].preScore).toBeGreaterThanOrEqual(windows.at(-1)!.preScore);
  });

  it("bounds estimated transcripts and produces schema-valid fallback copy", () => {
    const words = estimateTranscriptWords("How this works because the result matters. ".repeat(80), 90);
    const [window] = buildCandidateWindows({
      durationSeconds: 90,
      instruction: "result",
      maximumWindows: 3,
      words,
    });
    const fallback = fallbackCandidate(window);
    expect(words).toHaveLength(560);
    expect(fallback.socialCopy.youtubeShorts).toContain("#Shorts");
    expect(fallback.explanation).toMatch(/Hook .* clarity .* standalone .* story/i);
  });
});
