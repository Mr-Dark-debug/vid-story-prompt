import { z } from "zod";

export const socialCopySchema = z.object({
  youtubeShorts: z.string().min(1).max(500),
  instagram: z.string().min(1).max(500),
  tiktok: z.string().min(1).max(500),
  linkedin: z.string().min(1).max(700),
});

export const candidateOriginSchema = z.enum([
  "ai_discovery",
  "manual_timestamp",
  "transcript_selection",
]);

// Planner responses remain strictly scored AI candidates. The broader candidate
// contract also accepts user-selected ranges, without inventing ranking metrics.
export const aiClipCandidateSchema = z
  .object({
    origin: z.literal("ai_discovery").default("ai_discovery"),
    startSeconds: z.number().finite().nonnegative(),
    endSeconds: z.number().finite().positive(),
    title: z.string().trim().min(1).max(120),
    hook: z.string().trim().min(1).max(240),
    summary: z.string().trim().min(1).max(500),
    topic: z.string().trim().min(1).max(120),
    transcriptExcerpt: z.string().trim().min(1).max(8_000),
    standaloneScore: z.number().min(0).max(100),
    hookScore: z.number().min(0).max(100),
    clarityScore: z.number().min(0).max(100),
    storyScore: z.number().min(0).max(100),
    relevanceScore: z.number().min(0).max(100),
    technicalScore: z.number().min(0).max(100),
    overallScore: z.number().min(0).max(100),
    explanation: z.string().trim().min(1).max(600),
    socialCopy: socialCopySchema,
  })
  .refine((item) => item.endSeconds > item.startSeconds, "End must be after start");

export const selectedClipCandidateSchema = z
  .object({
    origin: candidateOriginSchema.exclude(["ai_discovery"]),
    startSeconds: z.number().finite().nonnegative(),
    endSeconds: z.number().finite().positive(),
    title: z.string().trim().min(1).max(120),
    hook: z.string().trim().max(240).default(""),
    summary: z.string().trim().max(500).default(""),
    topic: z.string().trim().max(120).default(""),
    transcriptExcerpt: z.string().trim().max(8_000).default(""),
    standaloneScore: z.null().default(null),
    hookScore: z.null().default(null),
    clarityScore: z.null().default(null),
    storyScore: z.null().default(null),
    relevanceScore: z.null().default(null),
    technicalScore: z.null().default(null),
    overallScore: z.null().default(null),
    explanation: z.string().trim().max(600).default(""),
    socialCopy: socialCopySchema.nullable().default(null),
  })
  .refine((item) => item.endSeconds > item.startSeconds, "End must be after start");

export const clipCandidateSchema = z.union([aiClipCandidateSchema, selectedClipCandidateSchema]);

export const clipPlanningResponseSchema = z.object({
  candidates: z.array(aiClipCandidateSchema).min(1).max(100),
});
