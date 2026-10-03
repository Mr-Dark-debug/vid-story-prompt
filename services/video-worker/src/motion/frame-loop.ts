import { createHash } from "node:crypto";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { openScene, seekFrame } from "./browser.js";
import { renderAudio } from "./audio.js";
import { frameQuality, startEncoder, verifyOutput } from "./encode.js";
import { HARD_LIMITS, validateSpec, type RenderSpec } from "./limits.js";

/** Critique samples use the identical sandbox/browser contract without encoding a video. */
export async function captureSceneKeyframes(
  source: string,
  specInput: RenderSpec,
  directory: string,
  options: {
    executablePath?: string;
    ffmpegPath: string;
    signal?: AbortSignal;
    bundledFontCss?: string;
  },
) {
  const spec = validateSpec(specInput);
  if (Buffer.byteLength(source) > HARD_LIMITS.sourceBytes)
    throw new Error("motion_source_over_limit");
  const signal = AbortSignal.any([
    ...(options.signal ? [options.signal] : []),
    AbortSignal.timeout(60_000),
  ]);
  const scene = await openScene(source, spec, { ...options, signal });
  try {
    const times = [
      0,
      spec.durationSeconds / 3,
      (spec.durationSeconds * 2) / 3,
      spec.durationSeconds,
    ];
    for (let index = 0; index < times.length; index++) {
      const png = await seekFrame(scene, times[index], signal);
      if (png.length > 2_000_000) throw new Error("motion_critique_frames_over_limit");
      await frameQuality(png, options.ffmpegPath, signal);
      await writeFile(join(directory, `keyframe-${index}.png`), png, { flag: "wx" });
    }
    await writeFile(
      join(directory, "manifest.json"),
      JSON.stringify({ contract: "vidrial-seek-v1", spec, times }),
      { flag: "wx" },
    );
  } finally {
    await scene.close().catch(() => undefined);
  }
}

/** Only callable inside the disposable sandbox, or with trusted authored test fixtures. */
export async function renderScene(
  source: string,
  specInput: RenderSpec,
  directory: string,
  options: {
    executablePath?: string;
    ffmpegPath: string;
    ffprobePath: string;
    watermark: boolean;
    signal?: AbortSignal;
    bundledFontCss?: string;
    onProgress?: (progress: number) => Promise<void>;
  },
) {
  const spec = validateSpec(specInput);
  if (Buffer.byteLength(source) > HARD_LIMITS.sourceBytes)
    throw new Error("motion_source_over_limit");
  const signal = AbortSignal.any([
    ...(options.signal ? [options.signal] : []),
    AbortSignal.timeout(HARD_LIMITS.totalTimeoutMs),
  ]);
  const scene = await openScene(source, spec, { ...options, signal });
  const output = join(directory, "output.mp4");
  let encoder: ReturnType<typeof startEncoder> | undefined;
  try {
    const quality = [];
    const times = [0, spec.durationSeconds / 2, spec.durationSeconds - 1 / spec.fps];
    const first = await seekFrame(scene, times[0], signal);
    for (const t of times)
      quality.push(
        await frameQuality(await seekFrame(scene, t, signal), options.ffmpegPath, signal),
      );
    // Seeking backward must reproduce the same pixels: catches accumulated physics/state.
    const repeated = await seekFrame(scene, 0, signal);
    if (!first.equals(repeated)) {
      await writeFile(join(directory, "first.png"), first);
      await writeFile(join(directory, "repeated.png"), repeated);
      throw new Error("motion_nondeterministic_scene");
    }
    await writeFile(join(directory, "poster.png"), await seekFrame(scene, times[1], signal), {
      flag: "wx",
    });
    const audioPath = join(directory, "audio.wav");
    const hasAudio = await renderAudio(scene, audioPath, spec.durationSeconds, signal);
    encoder = startEncoder(spec, output, {
      ...options,
      signal,
      audioPath: hasAudio ? audioPath : undefined,
    });
    const frames = Math.ceil(spec.durationSeconds * spec.fps);
    for (let i = 0; i < frames; i++) {
      signal.throwIfAborted();
      await encoder.write(await seekFrame(scene, i / spec.fps, signal));
      if (i % Math.max(1, spec.fps) === 0) await options.onProgress?.(i / frames);
    }
    await encoder.finish();
    const verified = await verifyOutput(output, spec, hasAudio, options.ffprobePath, signal);
    const manifest = {
      ...verified,
      spec,
      frameCount: frames,
      watermarked: options.watermark,
      sourceHash: createHash("sha256").update(source).digest("hex"),
      quality,
      contract: "vidrial-seek-v1",
    };
    await writeFile(join(directory, "manifest.json"), JSON.stringify(manifest), { flag: "wx" });
    await options.onProgress?.(1);
    return { output, poster: join(directory, "poster.png"), manifest };
  } finally {
    encoder?.kill();
    await scene.close().catch(() => undefined);
  }
}
