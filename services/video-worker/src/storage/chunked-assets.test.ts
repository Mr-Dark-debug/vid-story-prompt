import { describe, expect, it } from "vitest";
import { parseChunkManifest, planChunkedAsset } from "./chunked-assets.js";

describe("chunked private assets", () => {
  it("plans deterministic contiguous objects below the storage limit", () => {
    const planned = planChunkedAsset("workspace/user/job/source/file.mp4", 101, 40);
    expect(planned.parts).toEqual([
      expect.objectContaining({ path: "workspace/user/job/source/file.mp4.parts/00000", start: 0, end: 39, bytes: 40 }),
      expect.objectContaining({ path: "workspace/user/job/source/file.mp4.parts/00001", start: 40, end: 79, bytes: 40 }),
      expect.objectContaining({ path: "workspace/user/job/source/file.mp4.parts/00002", start: 80, end: 100, bytes: 21 }),
    ]);
    expect(parseChunkManifest(planned.manifest, "workspace/user/job/source/file.mp4")).toEqual(planned.manifest);
  });

  it("rejects path substitution and inconsistent byte totals", () => {
    const planned = planChunkedAsset("workspace/user/job/source/file.mp4", 81, 40);
    expect(() =>
      parseChunkManifest(
        { ...planned.manifest, parts: [{ path: "other/object", bytes: 40 }, ...planned.manifest.parts.slice(1)] },
        "workspace/user/job/source/file.mp4",
      ),
    ).toThrow(/unexpected object path/i);
    expect(() =>
      parseChunkManifest({ ...planned.manifest, totalBytes: 82 }, "workspace/user/job/source/file.mp4"),
    ).toThrow(/size does not match/i);
  });
});
