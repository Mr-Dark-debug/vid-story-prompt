export type AiRunView = {
  id: string;
  status: string;
  clipId: string;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
};

export type ClipRunState =
  | { kind: "working"; runId: string; label: string }
  | { kind: "failed"; runId: string; label: string }
  | null;

const ACTIVE = new Set(["queued", "leased", "running", "retry_wait"]);
const FAILED = new Set(["failed", "dead_lettered"]);

/** The newest run per clip decides what the card shows; a later success clears an earlier failure. */
export function latestRunByClip(runs: readonly AiRunView[]): Map<string, AiRunView> {
  const latest = new Map<string, AiRunView>();
  for (const run of runs) {
    const current = latest.get(run.clipId);
    if (!current || Date.parse(run.createdAt) > Date.parse(current.createdAt)) {
      latest.set(run.clipId, run);
    }
  }
  return latest;
}

export function clipRunState(run: AiRunView | undefined): ClipRunState {
  if (!run) return null;
  if (ACTIVE.has(run.status)) {
    return {
      kind: "working",
      runId: run.id,
      label:
        run.status === "retry_wait"
          ? "Provider busy, retrying shortly…"
          : "Writing copy with your model…",
    };
  }
  if (FAILED.has(run.status)) {
    return {
      kind: "failed",
      runId: run.id,
      // The worker stores user-facing copy only (never provider text), so it is safe to show.
      label: run.errorMessage ?? "Copy generation did not complete.",
    };
  }
  return null;
}

export function hasActiveRuns(runs: readonly AiRunView[]): boolean {
  return [...latestRunByClip(runs).values()].some((run) => ACTIVE.has(run.status));
}
