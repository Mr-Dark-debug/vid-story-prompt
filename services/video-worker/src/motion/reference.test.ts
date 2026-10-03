// @vitest-environment node
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from "vitest";
import { analyzeMotionReference } from "./reference.js";
import type { MotionClaim } from "./task.js";
import { runMediaTool } from "./encode.js";
const fixture = vi.hoisted(() => ({
  env: {
    MOTION_REFERENCE_ENABLED: true,
    WORKER_TEMP_ROOT: "",
    SUPABASE_URL: "https://reference.example.test",
    FFMPEG_PATH: "",
    FFPROBE_PATH: "",
  },
  completeJson: vi.fn(),
}));
vi.mock("../config/env.js", () => ({ env: fixture.env }));
vi.mock("../storage/client.js", () => ({
  supabase: {
    storage: {
      from: () => ({
        createSignedUrl: async () => ({
          data: { signedUrl: "https://reference.example.test/authorized" },
          error: null,
        }),
      }),
    },
  },
}));
vi.mock("./task.js", () => ({ motionAdapter: () => ({ completeJson: fixture.completeJson }) }));
const require = createRequire(import.meta.url);
const task = {
  workspace_id: "00000000-0000-4000-8000-000000000001",
  reference: {
    asset: {
      workspace_id: "00000000-0000-4000-8000-000000000001",
      storage_path: "00000000-0000-4000-8000-000000000001/authorized-source",
      storage_bucket: "source-media",
      size_bytes: 50000,
      duration_seconds: 8,
    },
  },
} as MotionClaim;
beforeAll(async () => {
  fixture.env.WORKER_TEMP_ROOT = await mkdtemp(join(tmpdir(), "motion-reference-fixture-"));
  fixture.env.FFMPEG_PATH = require("ffmpeg-static");
  fixture.env.FFPROBE_PATH = require("ffprobe-static").path;
  await runMediaTool(fixture.env.FFMPEG_PATH, [
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "testsrc2=size=320x180:rate=24",
    "-t",
    "8",
    "-c:v",
    "libx264",
    "-threads",
    "1",
    join(fixture.env.WORKER_TEMP_ROOT, "reference.mp4"),
  ]);
});
afterAll(async () => {
  await rm(fixture.env.WORKER_TEMP_ROOT, { recursive: true, force: true });
});
afterEach(async () => {
  expect(await readdir(fixture.env.WORKER_TEMP_ROOT)).toEqual(["reference.mp4"]);
  vi.unstubAllGlobals();
  fixture.completeJson.mockReset();
});
describe("reference media with explicit vision/storage mock boundary", () => {
  it("samples real original MP4 into contact sheet and validates principles", async () => {
    const bytes = await readFile(join(fixture.env.WORKER_TEMP_ROOT, "reference.mp4"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(bytes)));
    const brief = {
      pacing: "measured",
      cutsPerSecond: 0,
      palette: ["#1d1d1b"],
      typography: "Readable",
      transitionTypes: ["shape change"],
      beatTimings: [0, 4, 8],
      principles: ["Give the last idea a hold"],
    };
    fixture.completeJson.mockResolvedValue({
      value: brief,
      modelUsed: "explicit-vision-fixture",
      tokensUsed: 12,
    });
    const result = await analyzeMotionReference(task, new AbortController().signal);
    expect(result.brief).toEqual(brief);
    expect(result.modelUsed).toBe("explicit-vision-fixture");
    expect(fixture.completeJson.mock.calls[0][1].images[0]).toMatch(/^data:image\/jpeg;base64,/);
  });
  it("rejects renamed playlists before sending anything to vision", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            "#EXTM3U\n#EXT-X-TARGETDURATION:8\n#EXTINF:8,\nfile:///etc/passwd\n#EXT-X-ENDLIST\n",
          ),
        ),
    );
    await expect(analyzeMotionReference(task, new AbortController().signal)).rejects.toThrow(
      "motion_media_tool_failed",
    );
    expect(fixture.completeJson).not.toHaveBeenCalled();
  });
  it("rejects a reference from another workspace before requesting a signed URL", async () => {
    await expect(
      analyzeMotionReference(
        { ...task, workspace_id: "00000000-0000-4000-8000-000000000002" },
        new AbortController().signal,
      ),
    ).rejects.toThrow("motion_reference_over_limit");
    expect(fixture.completeJson).not.toHaveBeenCalled();
  });
});
