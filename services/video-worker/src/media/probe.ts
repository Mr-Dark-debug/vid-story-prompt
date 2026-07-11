import { execa } from "execa";
import { z } from "zod";
import { env } from "../config/env.js";
import { TaskFailure } from "../domain/types.js";

const probeSchema = z.object({ format: z.object({ format_name: z.string(), duration: z.string(), bit_rate: z.string().optional() }), streams: z.array(z.object({ codec_type: z.string(), codec_name: z.string().optional(), width: z.number().optional(), height: z.number().optional(), avg_frame_rate: z.string().optional(), sample_rate: z.string().optional(), channels: z.number().optional() })) });
export async function probeMedia(path: string) {
  let stdout: string;
  try { ({ stdout } = await execa(env.FFPROBE_PATH, ["-v","error","-show_format","-show_streams","-of","json",path], { timeout: 60_000 })); } catch { throw new TaskFailure("invalid_media", "FFprobe could not read the source media.", false); }
  const parsed = probeSchema.parse(JSON.parse(stdout));
  const video = parsed.streams.find((stream) => stream.codec_type === "video"); const audio = parsed.streams.find((stream) => stream.codec_type === "audio");
  const duration = Number(parsed.format.duration);
  if (!video || !Number.isFinite(duration) || duration <= 0) throw new TaskFailure("invalid_media", "The source has no playable video stream or duration.", false);
  return { container: parsed.format.format_name, durationSeconds: duration, videoCodec: video.codec_name ?? null, audioCodec: audio?.codec_name ?? null, width: video.width ?? null, height: video.height ?? null, frameRate: video.avg_frame_rate ?? null, hasAudio: Boolean(audio), audioSampleRate: audio?.sample_rate ? Number(audio.sample_rate) : null, audioChannels: audio?.channels ?? null, streamCount: parsed.streams.length };
}
