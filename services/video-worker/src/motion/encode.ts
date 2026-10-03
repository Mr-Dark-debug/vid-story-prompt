import { spawn } from "node:child_process";
import { once } from "node:events";
import { stat } from "node:fs/promises";
import { HARD_LIMITS, type RenderSpec } from "./limits.js";

export function startEncoder(
  spec: RenderSpec,
  output: string,
  options: { ffmpegPath: string; audioPath?: string; watermark: boolean; signal?: AbortSignal },
) {
  const args = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-nostdin",
    "-n",
    "-filter_threads",
    "1",
    "-filter_complex_threads",
    "1",
    "-threads",
    "1",
    "-f",
    "image2pipe",
    "-framerate",
    String(spec.fps),
    "-i",
    "pipe:0",
  ];
  if (options.audioPath) args.push("-i", options.audioPath);
  if (options.watermark)
    args.push(
      "-vf",
      "drawtext=text='Vidrial':fontcolor=white:fontsize=24:box=1:boxcolor=black@0.6:boxborderw=10:x=w-tw-24:y=h-th-24",
    );
  args.push(
    "-threads",
    "1",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
    "-t",
    String(spec.durationSeconds),
    "-movflags",
    "+faststart",
    "-fs",
    String(HARD_LIMITS.outputBytes),
  );
  if (options.audioPath) args.push("-c:a", "aac", "-b:a", "128k");
  else args.push("-an");
  args.push(output);
  const process = spawn(options.ffmpegPath, args, {
    stdio: ["pipe", "ignore", "pipe"],
    windowsHide: true,
    signal: options.signal,
  });
  // Drain stderr without returning model-supplied content or unbounded logs.
  let diagnostic = "";
  process.stderr.on("data", (chunk: Buffer) => {
    // Bounded in memory only. Never log filenames, scene data or provider text.
    diagnostic = (diagnostic + chunk.toString("utf8")).slice(-4096);
  });
  process.stdin.on("error", () => undefined);
  let exit: number | null = null;
  const done = new Promise<void>((resolve, reject) => {
    process.once("error", () =>
      reject(
        new Error(options.signal?.aborted ? "motion_cancelled" : "motion_encoder_start_failed"),
      ),
    );
    process.once("close", (code) => {
      exit = code;
      if (code === 0) resolve();
      else {
        const code = options.signal?.aborted
          ? "motion_cancelled"
          : /No such filter.*drawtext/.test(diagnostic)
            ? "motion_watermark_filter_unavailable"
            : /Resource temporarily unavailable|pthread_create/.test(diagnostic)
              ? "motion_encoder_resource_limit"
              : "motion_encode_failed";
        reject(new Error(code));
      }
    });
  });
  // Attach a rejection observer immediately; await the same promise at finish.
  void done.catch(() => undefined);
  return {
    write: async (png: Buffer) => {
      options.signal?.throwIfAborted();
      if (process.stdin.destroyed || exit !== null) throw new Error("motion_encode_failed");
      if (!process.stdin.write(png))
        await Promise.race([
          once(process.stdin, "drain"),
          done.then(() => {
            throw new Error("motion_encoder_early_exit");
          }),
        ]);
    },
    finish: async () => {
      process.stdin.end();
      await done;
    },
    kill: () => {
      process.stdin.destroy();
      process.kill("SIGKILL");
    },
  };
}

export async function runMediaTool(
  binary: string,
  args: string[],
  options: { input?: Buffer; signal?: AbortSignal; maxBytes?: number } = {},
) {
  const process = spawn(binary, args, {
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
    signal: options.signal,
  });
  process.stdin.on("error", () => undefined);
  const buffers: Buffer[] = [];
  let size = 0;
  process.stdout.on("data", (chunk: Buffer) => {
    size += chunk.length;
    if (size > (options.maxBytes ?? 1024 * 1024)) process.kill("SIGKILL");
    else buffers.push(chunk);
  });
  process.stderr.on("data", () => undefined);
  const result = new Promise<Buffer>((resolve, reject) => {
    process.once("error", () => reject(new Error("motion_media_tool_failed")));
    process.once("close", (code) =>
      code === 0 ? resolve(Buffer.concat(buffers)) : reject(new Error("motion_media_tool_failed")),
    );
  });
  const timer = setTimeout(() => process.kill("SIGKILL"), 15_000);
  process.stdin.end(options.input);
  try {
    return await result;
  } finally {
    clearTimeout(timer);
  }
}

export async function frameQuality(png: Buffer, ffmpegPath: string, signal?: AbortSignal) {
  const pixels = await runMediaTool(
    ffmpegPath,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-filter_threads",
      "1",
      "-threads",
      "1",
      "-f",
      "image2pipe",
      "-i",
      "pipe:0",
      "-vf",
      "scale=64:36",
      "-frames:v",
      "1",
      "-f",
      "rawvideo",
      "-pix_fmt",
      "gray",
      "pipe:1",
    ],
    { input: png, signal },
  );
  if (pixels.length !== 64 * 36) throw new Error("motion_quality_unreadable");
  const mean = pixels.reduce((a, b) => a + b, 0) / pixels.length;
  const deviation = Math.sqrt(pixels.reduce((a, b) => a + (b - mean) ** 2, 0) / pixels.length);
  if (deviation < 0.3) throw new Error("motion_blank_frame");
  return { mean, deviation };
}

export async function verifyOutput(
  path: string,
  spec: RenderSpec,
  hasAudio: boolean,
  ffprobePath: string,
  signal?: AbortSignal,
) {
  const size = (await stat(path)).size;
  if (size < 1000 || size >= HARD_LIMITS.outputBytes) throw new Error("motion_output_size_invalid");
  const info = JSON.parse(
    (
      await runMediaTool(
        ffprobePath,
        ["-v", "error", "-show_streams", "-show_format", "-of", "json", path],
        { signal },
      )
    ).toString("utf8"),
  ) as {
    format: { duration: string };
    streams: {
      codec_type: string;
      codec_name: string;
      pix_fmt?: string;
      width?: number;
      height?: number;
    }[];
  };
  const video = info.streams.find((stream) => stream.codec_type === "video");
  const audio = info.streams.find((stream) => stream.codec_type === "audio");
  const duration = Number(info.format.duration);
  if (
    !video ||
    video.codec_name !== "h264" ||
    video.pix_fmt !== "yuv420p" ||
    video.width !== spec.width ||
    video.height !== spec.height ||
    !Number.isFinite(duration) ||
    Math.abs(duration - spec.durationSeconds) > Math.max(0.12, 2 / spec.fps) ||
    (hasAudio && audio?.codec_name !== "aac")
  )
    throw new Error("motion_output_verification_failed");
  return { sizeBytes: size, durationSeconds: duration, hasAudio: Boolean(audio) };
}
