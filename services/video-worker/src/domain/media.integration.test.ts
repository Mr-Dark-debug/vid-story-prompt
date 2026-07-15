import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { execa } from "execa";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAss } from "../media/captions.js";

const require = createRequire(import.meta.url);
const ffmpeg = require("ffmpeg-static") as string;
const ffprobe = (require("ffprobe-static") as { path: string }).path;
let directory = "";
let source = "";
let watermarked = "";
let paid = "";
let captioned = "";
let audioRendered = "";
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "vidrial-media-test-"));
  source = join(directory, "source.mp4");
  watermarked = join(directory, "watermarked.mp4");
  paid = join(directory, "paid.mp4");
  captioned = join(directory, "captioned.mp4");
  audioRendered = join(directory, "audio-rendered.mp4");
  const audioSource = join(directory, "podcast.m4a");
  await execa(ffmpeg, [
    "-hide_banner",
    "-y",
    "-f",
    "lavfi",
    "-i",
    "testsrc2=size=320x180:rate=30",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=880:sample_rate=48000",
    "-t",
    "3",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    source,
  ]);
  await execa(ffmpeg, [
    "-hide_banner",
    "-y",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:sample_rate=48000",
    "-t",
    "3",
    "-c:a",
    "aac",
    audioSource,
  ]);
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key-at-least-twenty";
  process.env.FFMPEG_PATH = ffmpeg;
  process.env.FFPROBE_PATH = ffprobe;
  const { renderClip } = await import("../media/ffmpeg.js");
  await renderClip({
    source,
    output: watermarked,
    start: 0,
    duration: 2,
    width: 360,
    height: 640,
    watermark: true,
  });
  await renderClip({
    source,
    output: paid,
    start: 0,
    duration: 2,
    width: 360,
    height: 640,
    watermark: false,
  });
  await renderClip({
    source: audioSource,
    output: audioRendered,
    start: 0,
    duration: 2,
    width: 360,
    height: 640,
    watermark: false,
  });
  const ass = join(directory, "captions.ass");
  await writeFile(ass, createAss("Captions render deterministically", 2), "utf8");
  await renderClip({
    source,
    output: captioned,
    start: 0,
    duration: 2,
    width: 360,
    height: 640,
    watermark: false,
    captionsFile: ass,
  });
}, 60_000);
afterAll(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
});
async function probe(path: string) {
  const { stdout } = await execa(ffprobe, [
    "-v",
    "error",
    "-show_streams",
    "-show_format",
    "-of",
    "json",
    path,
  ]);
  return JSON.parse(stdout) as {
    streams: { codec_type: string; width?: number; height?: number }[];
    format: { duration: string };
  };
}
async function frameMd5(path: string) {
  const { stdout } = await execa(ffmpeg, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-ss",
    "1",
    "-i",
    path,
    "-frames:v",
    "1",
    "-f",
    "md5",
    "-",
  ]);
  return stdout.trim();
}
describe("FFmpeg worker fixture", () => {
  it("produces playable video and audio at requested dimensions and duration", async () => {
    for (const path of [watermarked, paid, captioned, audioRendered]) {
      const metadata = await probe(path);
      expect(Number(metadata.format.duration)).toBeGreaterThanOrEqual(1.9);
      expect(
        metadata.streams.some(
          (stream) =>
            stream.codec_type === "video" && stream.width === 360 && stream.height === 640,
        ),
      ).toBe(true);
      expect(metadata.streams.some((stream) => stream.codec_type === "audio")).toBe(true);
    }
  });
  it("creates a deterministic visual video stream for audio-only podcast sources", async () => {
    const metadata = await probe(audioRendered);
    expect(metadata.streams.some((stream) => stream.codec_type === "video")).toBe(true);
    expect(metadata.streams.some((stream) => stream.codec_type === "audio")).toBe(true);
  });
  it("changes rendered pixels only when the server watermark is enabled", async () =>
    expect(await frameMd5(watermarked)).not.toBe(await frameMd5(paid)));
  it("burns ASS captions into final video pixels", async () =>
    expect(await frameMd5(captioned)).not.toBe(await frameMd5(paid)));
});
