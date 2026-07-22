import { describe, expect, it } from "vitest";
import { TaskFailure } from "../domain/types.js";
import { normalizeTranscriptionResponse } from "./normalize-response.js";

describe("transcription provider response normalization", () => {
  it("accepts nullable optional Groq fields and numeric timestamp strings", () => {
    expect(
      normalizeTranscriptionResponse({
        text: "A complete sentence.",
        language: null,
        words: [{ word: "complete", start: "0.25", end: "0.75" }],
        segments: null,
      }),
    ).toEqual({
      text: "A complete sentence.",
      words: [{ word: "complete", start: 0.25, end: 0.75 }],
    });
  });

  it("falls back to segment timestamps when word timestamps are absent", () => {
    expect(
      normalizeTranscriptionResponse({
        text: "Segment fallback.",
        language: "en",
        words: null,
        segments: [{ text: "Segment fallback.", start: 1, end: 3 }],
      }),
    ).toEqual({
      text: "Segment fallback.",
      language: "en",
      words: [{ word: "Segment fallback.", start: 1, end: 3 }],
    });
  });

  it("keeps text-only responses usable with a bounded synthetic timestamp", () => {
    expect(
      normalizeTranscriptionResponse({ text: "Text only.", duration: 12, words: null }),
    ).toMatchObject({
      text: "Text only.",
      words: [{ word: "Text only.", start: 0, end: 12 }],
    });
  });

  it("classifies malformed provider data as an explicit retryable failure", () => {
    expect(() => normalizeTranscriptionResponse({ text: 42 })).toThrowError(TaskFailure);
    try {
      normalizeTranscriptionResponse({ text: 42 });
    } catch (error) {
      expect(error).toMatchObject({ code: "transcription_invalid_response", retryable: true });
    }
  });
});
