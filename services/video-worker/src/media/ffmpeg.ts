import { execa } from "execa";
import { env } from "../config/env.js";
import { probeMedia } from "./probe.js";
import type { EditManifest } from "./manifest.js";

export type RenderClipInput = {
  source: string;
  output: string;
  start: number;
  duration: number;
  width: number;
  height: number;
  watermark: boolean;
  captionsFile?: string;
  manifest?: EditManifest;
};

function filterPath(value: string) {
  return value.replaceAll("\\", "/").replace(":", "\\:").replaceAll("'", "\\'");
}

function drawtextValue(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'")
    .replaceAll(":", "\\:")
    .replaceAll("%", "\\%")
    .replaceAll("[", " ")
    .replaceAll("]", " ")
    .replaceAll(",", " ")
    .replaceAll(";", " ")
    .replace(/\r?\n/g, " ");
}

export function buildVideoFilterGraph(input: RenderClipInput) {
  const cropMode = input.manifest?.cropMode ?? "fit";
  const focal = input.manifest?.focalPoint ?? { x: 0.5, y: 0.5 };
  const stages: string[] = [];
  let current = "[0:v]";
  if (cropMode === "blur") {
    stages.push(`${current}split=2[blurbase][blurfront]`);
    stages.push(
      `[blurbase]scale=${input.width}:${input.height}:force_original_aspect_ratio=increase,crop=${input.width}:${input.height},boxblur=24:2[blurred]`,
    );
    stages.push(
      `[blurfront]scale=${input.width}:${input.height}:force_original_aspect_ratio=decrease[foreground]`,
    );
    stages.push("[blurred][foreground]overlay=(W-w)/2:(H-h)/2[stage0]");
    current = "[stage0]";
  } else if (cropMode === "fill" || cropMode === "manual" || cropMode === "centre") {
    const x = cropMode === "centre" ? 0.5 : focal.x;
    const y = cropMode === "centre" ? 0.5 : focal.y;
    stages.push(
      `${current}scale=${input.width}:${input.height}:force_original_aspect_ratio=increase,crop=${input.width}:${input.height}:(iw-ow)*${x.toFixed(4)}:(ih-oh)*${y.toFixed(4)}[stage0]`,
    );
    current = "[stage0]";
  } else {
    stages.push(
      `${current}scale=${input.width}:${input.height}:force_original_aspect_ratio=decrease,pad=${input.width}:${input.height}:(ow-iw)/2:(oh-ih)/2:black[stage0]`,
    );
    current = "[stage0]";
  }

  let stageIndex = 1;
  const append = (filter: string) => {
    const next = `[stage${stageIndex++}]`;
    stages.push(`${current}${filter}${next}`);
    current = next;
  };
  if (input.captionsFile) {
    append(
      `subtitles=filename='${filterPath(input.captionsFile)}':fontsdir='/usr/share/fonts/truetype/liberation2'`,
    );
  }
  for (const overlay of input.manifest?.textOverlays ?? []) {
    const alphaHex = overlay.backgroundColor.slice(7, 9);
    const alpha = alphaHex ? Number.parseInt(alphaHex, 16) / 255 : 0;
    append(
      `drawtext=font='Liberation Sans':text='${drawtextValue(overlay.text)}':fontcolor=${overlay.textColor}:fontsize=${overlay.fontSize}:x=w*${overlay.x.toFixed(4)}-tw/2:y=h*${overlay.y.toFixed(4)}-th/2:box=1:boxcolor=${overlay.backgroundColor.slice(0, 7)}@${alpha.toFixed(3)}:boxborderw=10:enable='between(t,${overlay.startSeconds.toFixed(3)},${overlay.endSeconds.toFixed(3)})'`,
    );
  }
  if (input.watermark) {
    append(
      "drawtext=font='Liberation Sans':text='Vidrial':fontcolor=white@0.72:fontsize=h*0.035:x=w-tw-w*0.035:y=h-th-h*0.035:box=1:boxcolor=black@0.25:boxborderw=8",
    );
  }
  stages.push(`${current}format=yuv420p[vout]`);
  return stages.join(";");
}

export function buildAudioFilters(input: RenderClipInput) {
  const audio = input.manifest?.audio;
  if (!audio) return [];
  const filters = [audio.muted ? "volume=0" : `volume=${audio.gainDb.toFixed(2)}dB`];
  if (audio.fadeInSeconds > 0) filters.push(`afade=t=in:st=0:d=${audio.fadeInSeconds.toFixed(3)}`);
  if (audio.fadeOutSeconds > 0) {
    filters.push(
      `afade=t=out:st=${Math.max(0, input.duration - audio.fadeOutSeconds).toFixed(3)}:d=${audio.fadeOutSeconds.toFixed(3)}`,
    );
  }
  if (audio.normalize && !audio.muted) filters.push("loudnorm=I=-16:TP=-1.5:LRA=11");
  return filters;
}

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
      "scale='min(1280,iw)':-2,fps=30",
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
export async function renderClip(input: RenderClipInput, signal?: AbortSignal) {
  const { hasAudio, hasVideo } = await probeMedia(input.source);
  const audioFilters = buildAudioFilters(input);
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
      "-filter_complex",
      buildVideoFilterGraph(input),
      "-map",
      "[vout]",
      ...(hasAudio ? ["-map", hasVideo ? "0:a:0" : "1:a:0"] : ["-an"]),
      "-c:v",
      "libx264",
      "-threads",
      String(env.FFMPEG_THREADS),
      "-preset",
      "veryfast",
      "-crf",
      "23",
      ...(hasAudio
        ? [
            ...(audioFilters.length ? ["-af", audioFilters.join(",")] : []),
            "-c:a",
            "aac",
            "-b:a",
            "160k",
          ]
        : []),
      "-movflags",
      "+faststart",
      ...(hasVideo ? [] : ["-shortest"]),
      input.output,
    ],
    { timeout: 60 * 60_000, cancelSignal: signal },
  );
}
