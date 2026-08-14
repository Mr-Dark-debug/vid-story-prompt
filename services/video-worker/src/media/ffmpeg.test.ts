import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.SUPABASE_URL = "https://worker-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "worker-test-service-role-key-long-enough";
});
import { buildAudioFilters, buildVideoFilterGraph, type RenderClipInput } from "./ffmpeg.js";

const base: RenderClipInput = {
  source: "/tmp/source.mp4",
  output: "/tmp/output.mp4",
  start: 10,
  duration: 30,
  width: 1080,
  height: 1920,
  watermark: true,
};

const manifest = {
  version: 2 as const,
  title: "Title",
  socialCopy: { youtubeShorts: "", instagram: "", tiktok: "", linkedin: "" },
  startSeconds: 10,
  endSeconds: 40,
  aspectRatio: "9:16" as const,
  cropMode: "manual" as const,
  focalPoint: { x: 0.2, y: 0.7 },
  safeArea: true,
  captions: {
    text: "Caption",
    cues: [],
    fontPreset: "clean_sans" as const,
    fontSize: 64,
    fontWeight: "bold" as const,
    position: "bottom" as const,
    alignment: "center" as const,
    textColor: "#ffffff",
    highlightColor: "#ff9a66",
    backgroundColor: "#000000",
    backgroundOpacity: 0.5,
    strokeColor: "#101010",
    strokeWidth: 4,
    shadow: true,
    activeWord: true,
    keywordHighlight: [],
    animation: "word_highlight" as const,
    profanityMask: false,
  },
  textOverlays: [
    {
      id: "one",
      text: "Safe: title; [not a graph]",
      startSeconds: 1,
      endSeconds: 4,
      x: 0.5,
      y: 0.2,
      fontSize: 42,
      textColor: "#ffffff",
      backgroundColor: "#00000080",
    },
  ],
  audio: { gainDb: 2, muted: false, fadeInSeconds: 1, fadeOutSeconds: 2, normalize: true },
};

describe("final render graph", () => {
  it("applies focal crop, captions, overlays and server watermark", () => {
    const graph = buildVideoFilterGraph({ ...base, captionsFile: "C:\\tmp\\clip.ass", manifest });
    expect(graph).toContain("force_original_aspect_ratio=increase");
    expect(graph).toContain("(iw-ow)*0.2000");
    expect(graph).toContain("subtitles=");
    expect(graph).toContain("between(t,1.000,4.000)");
    expect(graph).toContain("text='Vidrial'");
    expect(graph).not.toContain("[not a graph]");
  });

  it("builds blur backgrounds and bounded audio processing", () => {
    const graph = buildVideoFilterGraph({
      ...base,
      manifest: { ...manifest, cropMode: "blur", textOverlays: [] },
    });
    expect(graph).toMatch(/split=2.*boxblur.*overlay/s);
    expect(buildAudioFilters({ ...base, manifest })).toEqual([
      "volume=2.00dB",
      "afade=t=in:st=0:d=1.000",
      "afade=t=out:st=28.000:d=2.000",
      "loudnorm=I=-16:TP=-1.5:LRA=11",
    ]);
  });
});
