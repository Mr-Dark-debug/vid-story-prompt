import { describe, expect, it, vi } from "vitest";
vi.mock("../storage/client.js", () => ({ supabase: { rpc: vi.fn() } }));
import { supabase } from "../storage/client.js";
import { buildExactCutManifests, materializeExactCut } from "./exact-cut.js";
import { editManifestSchema } from "../media/manifest.js";

const ranges = Array.from({ length: 5 }, (_, index) => ({
  startSeconds: index * 10,
  endSeconds: (index + 1) * 10,
  label: `Moment ${index + 1}`,
}));
const settings = { mode: "manual_timestamp", ranges };
describe("Exact Cut worker branch", () => {
  it("builds ordinary editable manifests with captions off and exact ranges", () => {
    const manifests = buildExactCutManifests(settings, 600);
    expect(manifests).toHaveLength(5);
    manifests.forEach((manifest, index) => {
      expect(editManifestSchema.safeParse(manifest).success).toBe(true);
      expect(manifest).toMatchObject({
        startSeconds: index * 10,
        endSeconds: (index + 1) * 10,
        title: `Moment ${index + 1}`,
        captions: { text: "", cues: [] },
        audio: { normalize: false },
      });
    });
  });
  it("rejects short acquired sources and implicit caption requests", () => {
    expect(() => buildExactCutManifests(settings, 49)).toThrow("outside the acquired source");
    expect(() => buildExactCutManifests({ ...settings, captionsRequested: true }, 600)).toThrow(
      "invalid",
    );
    expect(() =>
      buildExactCutManifests({ ...settings, ranges: [{ startSeconds: 10, endSeconds: 5 }] }, 600),
    ).toThrow();
  });
  it("queues only ordinary previews after transactional materialization", async () => {
    const resultRows = ranges.map((_, index) => ({
      clipId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      candidateId: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    }));
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: resultRows, error: null } as never);
    const result = await materializeExactCut(
      {
        id: "task",
        clip_job_id: "job",
        task_type: "validate_source",
        status: "running",
        input_json: {},
        attempt: 1,
        max_attempts: 5,
        priority: 10,
        lease_owner: "worker",
      },
      settings,
      600,
    );
    expect(result.output).toMatchObject({ plannerSkipped: true, candidateCount: 5 });
    expect(result.children?.map((child) => child.taskType)).toEqual(
      Array(5).fill("render_clip_preview"),
    );
    expect(supabase.rpc).toHaveBeenCalledWith(
      "materialize_exact_cut",
      expect.objectContaining({ p_worker_id: "worker", p_task_id: "task" }),
    );
  });
});
