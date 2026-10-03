import { describe, expect, it } from "vitest";
import { clipRunState, hasActiveRuns, latestRunByClip, type AiRunView } from "./ai-run-status";

const run = (
  id: string,
  clipId: string,
  status: string,
  createdAt: string,
  extra: Partial<AiRunView> = {},
): AiRunView => ({ id, clipId, status, createdAt, errorCode: null, errorMessage: null, ...extra });

describe("clip run state", () => {
  it("uses only the newest run per clip, so a later success clears an earlier failure", () => {
    const latest = latestRunByClip([
      run("old", "c1", "failed", "2026-10-03T10:00:00Z", { errorMessage: "Reconnect your key" }),
      run("new", "c1", "succeeded", "2026-10-03T11:00:00Z"),
      run("other", "c2", "running", "2026-10-03T09:00:00Z"),
    ]);
    expect(latest.get("c1")?.id).toBe("new");
    expect(clipRunState(latest.get("c1"))).toBeNull();
    expect(clipRunState(latest.get("c2"))).toMatchObject({ kind: "working" });
  });

  it("distinguishes working, retrying and failed states with safe copy", () => {
    expect(clipRunState(run("a", "c", "queued", "2026-10-03T10:00:00Z"))).toMatchObject({
      kind: "working",
      label: "Writing copy with your model…",
    });
    expect(clipRunState(run("a", "c", "retry_wait", "2026-10-03T10:00:00Z"))).toMatchObject({
      kind: "working",
      label: expect.stringMatching(/retrying/),
    });
    expect(
      clipRunState(
        run("a", "c", "dead_lettered", "2026-10-03T10:00:00Z", {
          errorMessage: "Your provider is temporarily unavailable.",
        }),
      ),
    ).toEqual({ kind: "failed", runId: "a", label: "Your provider is temporarily unavailable." });
    expect(clipRunState(run("a", "c", "failed", "2026-10-03T10:00:00Z"))).toMatchObject({
      label: "Copy generation did not complete.",
    });
    expect(clipRunState(run("a", "c", "cancelled", "2026-10-03T10:00:00Z"))).toBeNull();
    expect(clipRunState(undefined)).toBeNull();
  });

  it("reports whether anything is still in flight", () => {
    expect(hasActiveRuns([run("a", "c", "running", "2026-10-03T10:00:00Z")])).toBe(true);
    expect(hasActiveRuns([run("a", "c", "succeeded", "2026-10-03T10:00:00Z")])).toBe(false);
    expect(hasActiveRuns([])).toBe(false);
  });
});
