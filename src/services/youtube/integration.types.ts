import { z } from "zod";

export const youtubeCapabilitySchema = z.enum(["channel_read", "video_publish"]);
export type YouTubeCapability = z.infer<typeof youtubeCapabilitySchema>;

export const automationRuleInputSchema = z.object({
  enabled: z.boolean(),
  sourceBehavior: z.enum(["create_draft", "start_when_source_exists"]),
  requestedClipCount: z.number().int().min(1).max(50),
  durationRange: z.enum(["15-30 seconds", "30-60 seconds", "60-90 seconds"]),
  captionPreset: z.string().trim().min(1).max(80),
  contentType: z.string().trim().min(1).max(80),
  publishingBehavior: z.enum(["do_not_publish", "queue_for_review", "schedule_approved"]),
  defaultPrivacy: z.enum(["private", "unlisted", "public"]),
  timezone: z.string().trim().min(1).max(80),
  rightsAccepted: z.boolean(),
});

export const publishInputSchema = z.object({
  exportId: z.string().uuid(),
  youtubeChannelId: z.string().uuid(),
  title: z.string().trim().min(1).max(100),
  description: z.string().max(5000).default(""),
  tags: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
  categoryId: z
    .string()
    .regex(/^\d{1,3}$/)
    .default("22"),
  madeForKids: z.boolean(),
  privacyStatus: z.enum(["private", "unlisted", "public"]).default("private"),
  scheduledFor: z.string().datetime().nullable(),
  idempotencyKey: z.string().uuid(),
});

export type AutomationRuleInput = z.infer<typeof automationRuleInputSchema>;
export type PublishInput = z.infer<typeof publishInputSchema>;
