import { z } from "zod";

export const socialCopySchema = z.object({
  youtubeShorts: z.string().min(1).max(500),
  instagram: z.string().min(1).max(500),
  tiktok: z.string().min(1).max(500),
  linkedin: z.string().min(1).max(700),
});

export const clipCandidateSchema = z
  .object({
    startSeconds: z.number().nonnegative(),
    endSeconds: z.number().positive(),
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

export const clipPlanningResponseSchema = z.object({
  candidates: z.array(clipCandidateSchema).min(1).max(100),
});
