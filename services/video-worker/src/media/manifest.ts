import { createHash } from "node:crypto";
import { z } from "zod";

const captionWordSchema = z.object({
  startSeconds: z.number().nonnegative(),
  endSeconds: z.number().positive(),
  text: z.string().trim().min(1).max(120),
});

const captionCueSchema = z
  .object({
    startSeconds: z.number().nonnegative(),
    endSeconds: z.number().positive(),
    text: z.string().trim().min(1).max(1_000),
    words: z.array(captionWordSchema).max(80).default([]),
  })
  .refine((cue) => cue.endSeconds > cue.startSeconds, "Caption cue end must be after start");

export const editManifestSchema = z
  .object({
    version: z.literal(2).default(2),
    title: z.string().trim().min(1).max(120),
    socialCopy: z
      .object({
        youtubeShorts: z.string().max(500).default(""),
        instagram: z.string().max(500).default(""),
        tiktok: z.string().max(500).default(""),
        linkedin: z.string().max(700).default(""),
      })
      .default({}),
    startSeconds: z.number().nonnegative(),
    endSeconds: z.number().positive(),
    aspectRatio: z.enum(["9:16", "1:1", "16:9"]),
    cropMode: z.enum(["fit", "fill", "centre", "blur", "manual"]),
    focalPoint: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }),
    safeArea: z.boolean().default(true),
    captions: z.object({
      text: z.string().max(20_000),
      cues: z.array(captionCueSchema).max(2_000).default([]),
      fontPreset: z.enum(["clean_sans", "editorial_serif", "mono_signal"]),
      fontSize: z.number().int().min(24).max(120),
      fontWeight: z.enum(["regular", "bold"]),
      position: z.enum(["top", "middle", "bottom"]),
      alignment: z.enum(["left", "center", "right"]),
      textColor: z.string().regex(/^#[0-9a-f]{6}$/i),
      highlightColor: z.string().regex(/^#[0-9a-f]{6}$/i),
      backgroundColor: z.string().regex(/^#[0-9a-f]{6}$/i),
      backgroundOpacity: z.number().min(0).max(1),
      strokeColor: z.string().regex(/^#[0-9a-f]{6}$/i),
      strokeWidth: z.number().min(0).max(8),
      shadow: z.boolean(),
      activeWord: z.boolean(),
      keywordHighlight: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
      animation: z.enum(["none", "word_highlight", "line_reveal", "pop"]),
      profanityMask: z.boolean(),
    }),
    textOverlays: z
      .array(
        z
          .object({
            id: z.string().min(1).max(100),
            text: z.string().trim().min(1).max(300),
            startSeconds: z.number().nonnegative(),
            endSeconds: z.number().positive(),
            x: z.number().min(0).max(1),
            y: z.number().min(0).max(1),
            fontSize: z.number().int().min(18).max(120),
            textColor: z.string().regex(/^#[0-9a-f]{6}$/i),
            backgroundColor: z.string().regex(/^#[0-9a-f]{8}$/i),
          })
          .refine((overlay) => overlay.endSeconds > overlay.startSeconds),
      )
      .max(12)
      .default([]),
    audio: z.object({
      gainDb: z.number().min(-30).max(12),
      muted: z.boolean(),
      fadeInSeconds: z.number().min(0).max(10),
      fadeOutSeconds: z.number().min(0).max(10),
      normalize: z.boolean(),
    }),
  })
  .refine((manifest) => manifest.endSeconds > manifest.startSeconds, "End must be after start");

export type EditManifest = z.infer<typeof editManifestSchema>;
export type CaptionCue = z.infer<typeof captionCueSchema>;

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export const renderManifestHash = (manifest: unknown) =>
  createHash("sha256").update(stableJson(manifest)).digest("hex");
