// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  assertIndexNowUrl,
  buildIndexNowBatches,
  classifyIndexNowResponse,
  createIndexNowPayload,
  createIndexNowReconciler,
  fingerprintIndexNowUrl,
  INDEXNOW_ENDPOINT,
  INDEXNOW_KEY,
  INDEXNOW_KEY_LOCATION,
  type IndexNowCandidate,
  type IndexNowRetryState,
  type IndexNowStore,
  type IndexNowStoredRecord,
  isAuthorizedIndexNowRequest,
} from "./server";

const migration = readFileSync(
  new URL("../../../supabase/migrations/20260731011000_indexnow_submissions.sql", import.meta.url),
  "utf8",
);
const proof = readFileSync(new URL(`../../../public/${INDEXNOW_KEY}.txt`, import.meta.url), "utf8");

function candidate(slug: string, revision = "2026-07-31"): IndexNowCandidate {
  const url = `https://vidrial.vercel.app/blog/${slug}`;
  return { url, fingerprint: fingerprintIndexNowUrl(url, revision) };
}

function memoryStore(initial: IndexNowStoredRecord[] = []) {
  const records = [...initial];
  const attempts: Array<{ candidate: IndexNowCandidate; attemptCount: number; reason: string }> =
    [];
  const results: Array<{ candidate: IndexNowCandidate; retryState: IndexNowRetryState }> = [];
  const store: IndexNowStore = {
    async list() {
      return [...records];
    },
    async recordAttempt(current, reason, attemptCount) {
      attempts.push({ candidate: current, attemptCount, reason });
      const prior = records.find(
        (record) => record.url === current.url && record.fingerprint === current.fingerprint,
      );
      if (prior) {
        prior.attemptCount = attemptCount;
        prior.retryState = "pending";
      } else {
        records.push({
          ...current,
          attemptCount,
          retryState: "pending",
          responseStatus: null,
        });
      }
    },
    async recordResult(current, result) {
      results.push({ candidate: current, retryState: result.retryState });
      const prior = records.find(
        (record) => record.url === current.url && record.fingerprint === current.fingerprint,
      );
      if (!prior) throw new Error("attempt was not recorded");
      prior.attemptCount = result.attemptCount;
      prior.retryState = result.retryState;
      prior.responseStatus = result.responseStatus;
    },
  };
  return { store, records, attempts, results };
}

function response(status: number) {
  return Promise.resolve(new Response(null, { status }));
}

describe("IndexNow protocol boundary", () => {
  it("accepts only parameter-free HTTPS URLs on the canonical origin", () => {
    expect(assertIndexNowUrl("https://vidrial.vercel.app/blog/guide")).toBe(
      "https://vidrial.vercel.app/blog/guide",
    );
    for (const invalid of [
      "http://vidrial.vercel.app/blog/guide",
      "https://vidrial.vercel.app.evil.test/blog/guide",
      "https://vidrial.vercel.app:444/blog/guide",
      "https://user:pass@vidrial.vercel.app/blog/guide",
      "https://vidrial.vercel.app/blog/guide?preview=1",
      "https://vidrial.vercel.app/blog/guide#summary",
      "/blog/guide",
    ]) {
      expect(() => assertIndexNowUrl(invalid)).toThrow(/canonical|absolute/i);
    }
  });

  it("deduplicates, sorts, and splits URL lists at 10,000", () => {
    const urls = Array.from(
      { length: 10_001 },
      (_, index) => `https://vidrial.vercel.app/blog/article-${String(index).padStart(5, "0")}`,
    );
    const batches = buildIndexNowBatches([urls[0], ...urls]);
    expect(batches).toHaveLength(2);
    expect(batches[0]).toHaveLength(10_000);
    expect(batches[1]).toHaveLength(1);
    expect(new Set(batches.flat()).size).toBe(10_001);
  });

  it("builds the exact IndexNow batch payload and proof location", () => {
    const url = "https://vidrial.vercel.app/blog/guide";
    expect(createIndexNowPayload([url])).toEqual({
      host: "vidrial.vercel.app",
      key: INDEXNOW_KEY,
      keyLocation: `https://vidrial.vercel.app/${INDEXNOW_KEY}.txt`,
      urlList: [url],
    });
    expect(INDEXNOW_KEY_LOCATION).toBe(`https://vidrial.vercel.app/${INDEXNOW_KEY}.txt`);
    expect(proof).toBe(`${INDEXNOW_KEY}\n`);
  });

  it("classifies successful, retryable, exhausted, and terminal statuses", () => {
    expect(classifyIndexNowResponse(200, 1)).toBe("submitted");
    expect(classifyIndexNowResponse(202, 1)).toBe("submitted");
    expect(classifyIndexNowResponse(429, 1)).toBe("retryable");
    expect(classifyIndexNowResponse(503, 4)).toBe("retryable");
    expect(classifyIndexNowResponse(503, 5)).toBe("terminal");
    expect(classifyIndexNowResponse(400, 1)).toBe("terminal");
    expect(classifyIndexNowResponse(403, 1)).toBe("terminal");
    expect(classifyIndexNowResponse(422, 1)).toBe("terminal");
  });

  it("requires a constant-time Bearer secret and never accepts query-string secrets", () => {
    const secret = "correct-trigger-secret-with-at-least-32-characters";
    expect(
      isAuthorizedIndexNowRequest(
        new Request("https://vidrial.vercel.app/api/indexnow/publish", {
          headers: { authorization: `Bearer ${secret}` },
        }),
        secret,
      ),
    ).toBe(true);
    expect(
      isAuthorizedIndexNowRequest(
        new Request(`https://vidrial.vercel.app/api/indexnow/publish?secret=${secret}`),
        secret,
      ),
    ).toBe(false);
    expect(
      isAuthorizedIndexNowRequest(
        new Request("https://vidrial.vercel.app/api/indexnow/publish", {
          headers: { authorization: "Bearer wrong-secret-that-is-also-long-enough" },
        }),
        secret,
      ),
    ).toBe(false);
  });
});

describe("IndexNow reconciliation", () => {
  it("suppresses an unchanged successfully submitted fingerprint", async () => {
    const current = candidate("guide");
    const { store } = memoryStore([
      { ...current, attemptCount: 1, retryState: "submitted", responseStatus: 202 },
    ]);
    const fetcher = vi.fn();
    const reconcile = createIndexNowReconciler({
      loadCandidates: () => [current],
      store,
      fetch: fetcher,
      now: () => new Date("2026-07-31T00:00:00.000Z"),
    });

    await expect(reconcile("deploy")).resolves.toEqual({
      considered: 1,
      unchanged: 1,
      submitted: 0,
      retryable: 0,
      terminal: 0,
      batches: 0,
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("records a successful submission without exposing the trigger secret", async () => {
    const current = candidate("new-guide");
    const { store, attempts, results } = memoryStore();
    const fetcher = vi.fn(() => response(202));
    const reconcile = createIndexNowReconciler({
      loadCandidates: () => [current],
      store,
      fetch: fetcher as typeof fetch,
      now: () => new Date("2026-07-31T00:00:00.000Z"),
    });

    const result = await reconcile("publish");

    expect(result.submitted).toBe(1);
    expect(attempts).toMatchObject([{ attemptCount: 1, reason: "publish" }]);
    expect(results).toMatchObject([{ retryState: "submitted" }]);
    expect(fetcher).toHaveBeenCalledWith(
      INDEXNOW_ENDPOINT,
      expect.objectContaining({ method: "POST" }),
    );
    const serializedState = JSON.stringify({ result, attempts, results });
    expect(serializedState).not.toContain("correct-trigger-secret");
  });

  it("persists retryable failures and terminates them at the fifth attempt", async () => {
    const current = candidate("retry-guide");
    const retryStore = memoryStore([
      { ...current, attemptCount: 2, retryState: "retryable", responseStatus: 429 },
    ]);
    const retry = createIndexNowReconciler({
      loadCandidates: () => [current],
      store: retryStore.store,
      fetch: vi.fn(() => response(503)) as typeof fetch,
      now: () => new Date(),
    });
    await expect(retry("reconcile")).resolves.toMatchObject({ retryable: 1 });
    expect(retryStore.results.at(-1)?.retryState).toBe("retryable");

    const terminalStore = memoryStore([
      { ...current, attemptCount: 4, retryState: "retryable", responseStatus: 503 },
    ]);
    const terminal = createIndexNowReconciler({
      loadCandidates: () => [current],
      store: terminalStore.store,
      fetch: vi.fn(() => response(503)) as typeof fetch,
      now: () => new Date(),
    });
    await expect(terminal("reconcile")).resolves.toMatchObject({ terminal: 1 });
    expect(terminalStore.results.at(-1)?.retryState).toBe("terminal");
  });

  it("submits a deletion fingerprint for a formerly published URL", async () => {
    const removed = candidate("removed-guide", "old-revision");
    const storeState = memoryStore([
      { ...removed, attemptCount: 1, retryState: "submitted", responseStatus: 200 },
    ]);
    const fetcher = vi.fn(() => response(200));
    const reconcile = createIndexNowReconciler({
      loadCandidates: () => [],
      store: storeState.store,
      fetch: fetcher as typeof fetch,
      now: () => new Date(),
    });

    await expect(reconcile("deploy")).resolves.toMatchObject({ considered: 1, submitted: 1 });
    expect(storeState.attempts[0]).toMatchObject({ reason: "delete" });
    expect(storeState.attempts[0]?.candidate.fingerprint).toBe(
      fingerprintIndexNowUrl(removed.url, "deleted"),
    );
  });
});

describe("IndexNow migration", () => {
  it("stores bounded attempts, response status, fingerprints, and retry state", () => {
    expect(migration).toMatch(/unique \(url, fingerprint\)/);
    expect(migration).toMatch(/response_status integer/);
    expect(migration).toMatch(/attempt_count between 0 and 5/);
    expect(migration).toMatch(/retry_state in \('pending', 'submitted', 'retryable', 'terminal'\)/);
    expect(migration).toMatch(/last_attempt_at timestamptz/);
    expect(migration).toMatch(/submitted_at timestamptz/);
  });

  it("keeps the reconciliation log service-role-only", () => {
    expect(migration).toMatch(/alter table public\.indexnow_submissions enable row level security/);
    expect(migration).toMatch(
      /revoke all on table public\.indexnow_submissions from public, anon, authenticated/,
    );
    expect(migration).toMatch(
      /grant select, insert, update, delete on table public\.indexnow_submissions to service_role/,
    );
  });
});
