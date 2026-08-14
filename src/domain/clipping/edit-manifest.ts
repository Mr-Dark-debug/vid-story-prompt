import { z } from "zod";

export const captionCueSchema = z
  .object({
    startSeconds: z.number().nonnegative(),
    endSeconds: z.number().positive(),
    text: z.string().trim().min(1).max(1_000),
    words: z
      .array(
        z.object({
          startSeconds: z.number().nonnegative(),
          endSeconds: z.number().positive(),
          text: z.string().trim().min(1).max(120),
        }),
      )
      .max(80),
  })
  .refine((cue) => cue.endSeconds > cue.startSeconds, "Caption cue end must be after start");

export const editManifestSchema = z
  .object({
    version: z.literal(2),
    title: z.string().trim().min(1).max(120),
    socialCopy: z.object({
      youtubeShorts: z.string().max(500),
      instagram: z.string().max(500),
      tiktok: z.string().max(500),
      linkedin: z.string().max(700),
    }),
    startSeconds: z.number().nonnegative(),
    endSeconds: z.number().positive(),
    aspectRatio: z.enum(["9:16", "1:1", "16:9"]),
    cropMode: z.enum(["fit", "fill", "centre", "blur", "manual"]),
    focalPoint: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }),
    safeArea: z.boolean(),
    captions: z.object({
      text: z.string().max(20_000),
      cues: z.array(captionCueSchema).max(2_000),
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
      keywordHighlight: z.array(z.string().trim().min(1).max(80)).max(30),
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
      .max(12),
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

export function defaultEditManifest(input: {
  durationSeconds: number;
  socialCopy?: unknown;
  text: string;
  title: string;
}): EditManifest {
  const social =
    input.socialCopy && typeof input.socialCopy === "object" && !Array.isArray(input.socialCopy)
      ? (input.socialCopy as Record<string, unknown>)
      : {};
  return {
    version: 2,
    title: input.title,
    socialCopy: {
      youtubeShorts: String(social.youtubeShorts ?? ""),
      instagram: String(social.instagram ?? ""),
      tiktok: String(social.tiktok ?? ""),
      linkedin: String(social.linkedin ?? ""),
    },
    startSeconds: 0,
    endSeconds: input.durationSeconds,
    aspectRatio: "9:16",
    cropMode: "fill",
    focalPoint: { x: 0.5, y: 0.5 },
    safeArea: true,
    captions: {
      text: input.text,
      cues: [],
      fontPreset: "clean_sans",
      fontSize: 64,
      fontWeight: "bold",
      position: "bottom",
      alignment: "center",
      textColor: "#ffffff",
      highlightColor: "#ff9a66",
      backgroundColor: "#000000",
      backgroundOpacity: 0.5,
      strokeColor: "#101010",
      strokeWidth: 4,
      shadow: true,
      activeWord: true,
      keywordHighlight: [],
      animation: "word_highlight",
      profanityMask: false,
    },
    textOverlays: [],
    audio: {
      gainDb: 0,
      muted: false,
      fadeInSeconds: 0.15,
      fadeOutSeconds: 0.15,
      normalize: true,
    },
  };
}

export function normalizeEditManifest(value: unknown, fallback: EditManifest): EditManifest {
  const current = editManifestSchema.safeParse(value);
  if (current.success) return current.data;
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const legacy = value as Record<string, unknown>;
  const legacyCaptions =
    legacy.captions && typeof legacy.captions === "object" && !Array.isArray(legacy.captions)
      ? (legacy.captions as Record<string, unknown>)
      : {};
  const legacyAudio =
    legacy.audio && typeof legacy.audio === "object" && !Array.isArray(legacy.audio)
      ? (legacy.audio as Record<string, unknown>)
      : {};
  return editManifestSchema.parse({
    ...fallback,
    startSeconds: Number(legacy.startSeconds ?? fallback.startSeconds),
    endSeconds: Number(legacy.endSeconds ?? fallback.endSeconds),
    aspectRatio: legacy.aspectRatio ?? fallback.aspectRatio,
    cropMode: legacy.cropMode ?? fallback.cropMode,
    focalPoint: legacy.focalPoint ?? fallback.focalPoint,
    captions: {
      ...fallback.captions,
      text: String(legacyCaptions.text ?? fallback.captions.text),
      position: legacyCaptions.position ?? fallback.captions.position,
      activeWord: Boolean(legacyCaptions.activeWord ?? fallback.captions.activeWord),
      profanityMask: Boolean(legacyCaptions.profanityMask ?? fallback.captions.profanityMask),
    },
    audio: {
      ...fallback.audio,
      gainDb: Number(legacyAudio.gainDb ?? fallback.audio.gainDb),
      muted: Boolean(legacyAudio.muted ?? fallback.audio.muted),
      fadeInSeconds: Number(legacyAudio.fadeInSeconds ?? fallback.audio.fadeInSeconds),
      fadeOutSeconds: Number(legacyAudio.fadeOutSeconds ?? fallback.audio.fadeOutSeconds),
    },
  });
}
