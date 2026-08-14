import { describe, expect, it } from "vitest";
import { buildCaptionCues, createAss, createSrt, createVtt } from "./captions.js";

const cues = buildCaptionCues(
  [
    { start: 10, end: 10.5, text: "Why" },
    { start: 10.6, end: 11.2, text: "latency" },
    { start: 11.3, end: 12, text: "matters." },
    { start: 12.2, end: 12.8, text: "It" },
    { start: 12.9, end: 13.5, text: "changes" },
    { start: 13.6, end: 14.2, text: "architecture." },
  ],
  10,
  15,
);

describe("caption rendering", () => {
  it("preserves immutable word timing in sidecars", () => {
    expect(cues[0].words[0]).toEqual({ startSeconds: 0, endSeconds: 0.5, text: "Why" });
    expect(createSrt("", 5, cues)).toContain("00:00:00,000 --> 00:00:02,000");
    expect(createVtt("", 5, cues)).toMatch(/^WEBVTT/);
  });

  it("emits centisecond karaoke and allowlisted licensed fonts", () => {
    const ass = createAss("", 5, {
      cues,
      settings: { animation: "word_highlight", fontPreset: "mono_signal", activeWord: true },
    });
    expect(ass).toContain("Liberation Mono");
    expect(ass).toMatch(/\\kf50}Why/);
    expect(ass).not.toContain("undefined");
  });

  it("bakes line reveal and pop transforms while stripping ASS injection", () => {
    const reveal = createAss("hello {\\pos(1,1)} world line reveal", 4, {
      settings: { animation: "line_reveal", activeWord: false },
    });
    const pop = createAss("hello {bad} world", 4, {
      settings: { animation: "pop", activeWord: false, fontPreset: "editorial_serif" },
    });
    expect(reveal).toContain("Dialogue:");
    expect(reveal).not.toContain("{\\pos(1,1)}");
    expect(pop).toContain("\\t(0,180,\\fscx100\\fscy100)");
    expect(pop).toContain("Liberation Serif");
  });

  it("bakes keyword colour and optional profanity masking into ASS", () => {
    const ass = createAss("Latency is damn important", 3, {
      settings: {
        animation: "none",
        activeWord: false,
        keywordHighlight: ["latency"],
        profanityMask: true,
      },
    });
    expect(ass).toContain("{\\1c&H00");
    expect(ass).toContain("Latency");
    expect(ass).toContain("●●●●");
    expect(ass).not.toMatch(/\bdamn\b/i);
  });
});
