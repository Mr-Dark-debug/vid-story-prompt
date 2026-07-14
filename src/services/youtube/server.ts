import { createHash } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { getServerEnv } from "@/config/env.server";
import { parseIsoDuration, parseYouTubeVideoId } from "./parser";

const hits = new Map<string, number[]>();
type PublicMetadata = {
  videoId: string;
  title: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  durationSeconds: number;
  thumbnailUrl: string;
  availability: string;
  embeddable: boolean;
  ownership: "unknown";
};
const metadataCache = new Map<string, { expiresAt: number; value: PublicMetadata }>();
function enforceRateLimit() {
  const key = createHash("sha256")
    .update(getRequestIP({ xForwardedFor: true }) ?? "unknown")
    .digest("hex");
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((time) => time > now - 60_000);
  if (recent.length >= 10) throw new Error("Too many metadata requests. Wait a minute and retry.");
  recent.push(now);
  hits.set(key, recent);
}

async function verifyTurnstile(token: string | undefined) {
  const serverEnv = getServerEnv();
  const secret = serverEnv.TURNSTILE_SECRET_KEY;
  // Optional protection must be configured as a complete client/server pair.
  // IP rate limiting remains active when the optional widget is disabled.
  if (!secret || !serverEnv.VITE_TURNSTILE_SITE_KEY) return;
  if (!token) throw new Error("Complete the abuse-protection check and retry.");
  const requestIp = getRequestIP({ xForwardedFor: true });
  const body = new URLSearchParams({ secret, response: token });
  if (requestIp) body.set("remoteip", requestIp);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
    signal: AbortSignal.timeout(8_000),
  });
  const result = z
    .object({
      action: z.string().optional(),
      hostname: z.string().optional(),
      success: z.boolean(),
    })
    .parse(await response.json());
  if (!result.success) throw new Error("The abuse-protection check expired. Retry it.");
  if (result.action !== "youtube_metadata")
    throw new Error("The abuse-protection check was issued for a different action.");
  const expectedHostname = new URL(serverEnv.PUBLIC_APP_URL).hostname;
  if (
    expectedHostname !== "localhost" &&
    expectedHostname !== "127.0.0.1" &&
    result.hostname !== expectedHostname
  )
    throw new Error("The abuse-protection check was issued for a different website.");
}

const youtubeResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      snippet: z.object({
        title: z.string(),
        channelId: z.string(),
        channelTitle: z.string(),
        publishedAt: z.string(),
        liveBroadcastContent: z.string(),
        thumbnails: z.record(z.object({ url: z.string().url() })),
      }),
      contentDetails: z.object({ duration: z.string() }),
      status: z.object({
        privacyStatus: z.string(),
        uploadStatus: z.string(),
        embeddable: z.boolean().optional(),
      }),
    }),
  ),
});

export async function fetchYouTubeMetadataById(videoId: string): Promise<PublicMetadata> {
  const cached = metadataCache.get(videoId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const apiKey = getServerEnv().YOUTUBE_API_KEY;
  if (!apiKey)
    throw new Error("YouTube metadata is not configured yet. Add YOUTUBE_API_KEY and retry.");
  const params = new URLSearchParams({
    id: videoId,
    key: apiKey,
    part: "snippet,contentDetails,status",
  });
  const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`, {
    signal: AbortSignal.timeout(10_000),
    headers: { accept: "application/json" },
  });
  if (!response.ok)
    throw new Error(
      response.status === 403
        ? "YouTube metadata quota is unavailable. Retry later."
        : "YouTube metadata could not be retrieved.",
    );
  const result = youtubeResponseSchema.parse(await response.json());
  const video = result.items[0];
  if (!video || video.status.uploadStatus !== "processed")
    throw new Error("This video is unavailable or still processing.");
  const durationSeconds = parseIsoDuration(video.contentDetails.duration);
  if (video.snippet.liveBroadcastContent !== "none" && durationSeconds === 0)
    throw new Error("Live broadcasts are not supported until they finish processing.");
  const thumbnail =
    video.snippet.thumbnails.maxres ??
    video.snippet.thumbnails.standard ??
    video.snippet.thumbnails.high ??
    video.snippet.thumbnails.medium ??
    video.snippet.thumbnails.default;
  const value: PublicMetadata = {
    videoId,
    title: video.snippet.title,
    channelId: video.snippet.channelId,
    channelTitle: video.snippet.channelTitle,
    publishedAt: video.snippet.publishedAt,
    durationSeconds,
    thumbnailUrl: thumbnail?.url ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    availability: video.status.privacyStatus,
    embeddable: video.status.embeddable ?? true,
    ownership: "unknown",
  };
  metadataCache.set(videoId, { expiresAt: Date.now() + 5 * 60_000, value });
  return value;
}

export const getYouTubeMetadata = createServerFn({ method: "POST" })
  .validator(z.object({ url: z.string().url().max(2048), turnstileToken: z.string().optional() }))
  .handler(async ({ data }) => {
    enforceRateLimit();
    await verifyTurnstile(data.turnstileToken);
    const videoId = parseYouTubeVideoId(data.url);
    return fetchYouTubeMetadataById(videoId);
  });
