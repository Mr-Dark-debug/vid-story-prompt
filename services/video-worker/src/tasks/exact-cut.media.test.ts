import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execa } from "execa";
import { describe, expect, it, vi } from "vitest";

// Opt-in real FFmpeg test: no credentials, network, transcription or planner.
vi.mock("../storage/client.js", () => ({ supabase: { rpc: vi.fn() } }));
vi.mock("../config/env.js", () => ({
  env: {
    FFMPEG_PATH: process.env.TEST_FFMPEG_PATH ?? "ffmpeg",
    FFPROBE_PATH: process.env.TEST_FFPROBE_PATH ?? "ffprobe",
    FFMPEG_THREADS: 1,
  },
}));
import { buildExactCutManifests } from "./exact-cut.js";
import { renderClip } from "../media/ffmpeg.js";
import { probeMedia } from "../media/probe.js";

describe.skipIf(process.env.TEST_REAL_FFMPEG !== "1")("Exact Cut real media contract", () => {
  it("renders five separate silent-video clips through the existing watermarked renderer", async () => {
    const directory = await mkdtemp(join(tmpdir(), "vidrial-exact-cut-test-"));
    try {
      const source = join(directory, "generated-source.mp4");
      await execa(process.env.TEST_FFMPEG_PATH ?? "ffmpeg", [
        "-hide_banner",
        "-nostdin",
        "-f",
        "lavfi",
        "-i",
        "testsrc2=size=320x180:rate=30",
        "-t",
        "20",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        source,
      ]);
      const manifests = buildExactCutManifests(
        {
          mode: "manual_timestamp",
          ranges: Array.from({ length: 5 }, (_, index) => ({
            startSeconds: index * 3 + 0.1,
            endSeconds: index * 3 + 2.1,
            label: `Exact cut ${index + 1}`,
          })),
        },
        20,
      );
      for (const [index, manifest] of manifests.entries()) {
        const output = join(directory, `clip-${index}.mp4`);
        await renderClip({
          source,
          output,
          start: manifest.startSeconds,
          duration: 2,
          width: 360,
          height: 640,
          watermark: true,
          manifest,
        });
        const metadata = await probeMedia(output);
        expect(metadata.hasVideo).toBe(true);
        expect(metadata.hasAudio).toBe(false);
        expect(metadata.durationSeconds).toBeCloseTo(2, 1);
        // Decode every frame, not just container metadata.
        await execa(process.env.TEST_FFMPEG_PATH ?? "ffmpeg", [
          "-v",
          "error",
          "-xerror",
          "-i",
          output,
          "-f",
          "null",
          "-",
        ]);
      }
    } finally {
      // Only the uniquely created test directory, never a user media directory.
      await rm(directory, { recursive: true, force: true });
    }
  }, 120_000);
});
