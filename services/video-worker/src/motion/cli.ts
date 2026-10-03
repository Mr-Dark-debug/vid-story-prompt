import { readFile, stat } from "node:fs/promises";
import { renderScene, captureSceneKeyframes } from "./frame-loop.js";
import { HARD_LIMITS, validateSpec, type RenderSpec } from "./limits.js";

// Fixed paths only. This entry point never imports worker env, providers or storage.
try {
  if ((await stat("/input/scene.html")).size > HARD_LIMITS.sourceBytes)
    throw new Error("motion_source_over_limit");
  if ((await stat("/input/spec.json")).size > 4096) throw new Error("motion_spec_over_limit");
  const spec = JSON.parse(await readFile("/input/spec.json", "utf8")) as RenderSpec & {
    watermarked: boolean;
    mode?: string;
  };
  if (typeof spec.watermarked !== "boolean") throw new Error("motion_spec_invalid");
  if (spec.mode !== "render" && spec.mode !== "keyframes") throw new Error("motion_spec_invalid");
  const source = await readFile("/input/scene.html", "utf8");
  const bundledFontCss = await readFile("/renderer/fonts.css", "utf8");
  if (spec.mode === "keyframes")
    await captureSceneKeyframes(source, validateSpec(spec), "/output", {
      ffmpegPath: "/usr/bin/ffmpeg",
      bundledFontCss,
    });
  else
    await renderScene(source, validateSpec(spec), "/output", {
      ffmpegPath: "/usr/bin/ffmpeg",
      ffprobePath: "/usr/bin/ffprobe",
      watermark: spec.watermarked,
      bundledFontCss,
      onProgress: async (progress) => {
        process.stdout.write(
          `${JSON.stringify({ motionProgress: Number(progress.toFixed(4)) })}\n`,
        );
      },
    });
} catch (error) {
  const code =
    error instanceof Error && /^motion_[a-z_]+$/.test(error.message)
      ? error.message
      : "motion_browser_failed";
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
}
