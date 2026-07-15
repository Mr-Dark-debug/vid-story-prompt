import { execa } from "execa";
import { env } from "../config/env.js";
import { probeMedia } from "./probe.js";

export async function extractSpeechAudio(source: string, output: string, signal?: AbortSignal) {
  await execa(
    env.FFMPEG_PATH,
    [
      "-hide_banner",
      "-nostdin",
      "-y",
      "-i",
      source,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-af",
      "loudnorm=I=-20:TP=-2:LRA=11",
      "-c:a",
      "flac",
      output,
    ],
    { timeout: 30 * 60_000, cancelSignal: signal },
  );
}
export async function createProxy(source: string, output: string, signal?: AbortSignal) {
  const { hasVideo } = await probeMedia(source);
  const input = hasVideo
    ? ["-i", source]
    : ["-f", "lavfi", "-i", "color=c=#1f2024:s=1280x720:r=30", "-i", source];
  await execa(
    env.FFMPEG_PATH,
    [
      "-hide_banner",
      "-nostdin",
      "-y",
      ...input,
      ...(hasVideo ? [] : ["-map", "0:v:0", "-map", "1:a:0", "-shortest"]),
      "-vf",
      "scale='min(1280,iw)':-2",
      "-c:v",
      "libx264",
      "-threads",
      String(env.FFMPEG_THREADS),
      "-preset",
      "veryfast",
      "-crf",
      "25",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      output,
    ],
    { timeout: 60 * 60_000, cancelSignal: signal },
  );
}
export async function renderClip(
  input: {
    source: string;
    output: string;
    start: number;
    duration: number;
    width: number;
    height: number;
    watermark: boolean;
    captionsFile?: string;
  },
  signal?: AbortSignal,
) {
  const { hasVideo } = await probeMedia(input.source);
  const filters = [
    `scale=${input.width}:${input.height}:force_original_aspect_ratio=decrease`,
    `pad=${input.width}:${input.height}:(ow-iw)/2:(oh-ih)/2:black`,
  ];
  if (input.captionsFile) {
    const subtitlePath = input.captionsFile
      .replaceAll("\\", "/")
      .replace(":", "\\:")
      .replaceAll("'", "\\'");
    filters.push(`subtitles=filename='${subtitlePath}'`);
  }
  if (input.watermark)
    filters.push(
      "drawtext=text='Vidrial':fontcolor=white@0.72:fontsize=h*0.035:x=w-tw-w*0.035:y=h-th-h*0.035:box=1:boxcolor=black@0.25:boxborderw=8",
    );
  await execa(
    env.FFMPEG_PATH,
    [
      "-hide_banner",
      "-nostdin",
      "-y",
      ...(hasVideo
        ? ["-ss", String(input.start), "-i", input.source]
        : [
            "-f",
            "lavfi",
            "-i",
            `color=c=#1f2024:s=${input.width}x${input.height}:r=30`,
            "-ss",
            String(input.start),
            "-i",
            input.source,
            "-map",
            "0:v:0",
            "-map",
            "1:a:0",
          ]),
      "-t",
      String(input.duration),
      "-vf",
      filters.join(","),
      "-c:v",
      "libx264",
      "-threads",
      String(env.FFMPEG_THREADS),
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-c:a",
      "aac",
      "-b:a",
      "160k",
      "-movflags",
      "+faststart",
      ...(hasVideo ? [] : ["-shortest"]),
      input.output,
    ],
    { timeout: 60 * 60_000, cancelSignal: signal },
  );
}
