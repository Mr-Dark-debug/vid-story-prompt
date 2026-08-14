import { createHash, timingSafeEqual } from "node:crypto";
import { getPublishedArticles } from "@/features/blog/repository.server";
import { blogCategorySlug } from "@/features/blog/category";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const INDEXNOW_ORIGIN = "https://vidrial.vercel.app";
export const INDEXNOW_HOST = "vidrial.vercel.app";
export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
export const INDEXNOW_KEY = "632573bd4c22eb026288a736579ebeba9bdb3b8480acee68dc7b47f0133eb2f2";
export const INDEXNOW_KEY_LOCATION = `${INDEXNOW_ORIGIN}/${INDEXNOW_KEY}.txt`;

const MAX_BATCH_SIZE = 10_000;
const MAX_ATTEMPTS = 5;
const REQUEST_TIMEOUT_MS = 10_000;

export type IndexNowReason = "publish" | "update" | "delete" | "deploy" | "manual" | "reconcile";
export type IndexNowRetryState = "pending" | "submitted" | "retryable" | "terminal";

export type IndexNowCandidate = {
  url: string;
  fingerprint: string;
  reason?: IndexNowReason;
};

export type IndexNowStoredRecord = IndexNowCandidate & {
  attemptCount: number;
  retryState: IndexNowRetryState;
  responseStatus: number | null;
};

export type IndexNowReconciliationResult = {
  considered: number;
  unchanged: number;
  submitted: number;
  retryable: number;
  terminal: number;
  batches: number;
};

export type IndexNowStore = {
  list(): Promise<IndexNowStoredRecord[]>;
  recordAttempt(
    candidate: IndexNowCandidate,
    reason: IndexNowReason,
    attemptCount: number,
  ): Promise<void>;
  recordResult(
    candidate: IndexNowCandidate,
    result: {
      responseStatus: number | null;
      retryState: IndexNowRetryState;
      attemptCount: number;
      submittedAt: string | null;
    },
  ): Promise<void>;
};

type IndexNowDependencies = {
  loadCandidates: () => Promise<IndexNowCandidate[]> | IndexNowCandidate[];
  store: IndexNowStore;
  fetch: typeof fetch;
  now: () => Date;
  timeoutMs?: number;
};

type DbError = { message?: string };
type LooseDbResult = { data: unknown; error: DbError | null };
type LooseDbQuery = PromiseLike<LooseDbResult> & {
  select(columns: string): LooseDbQuery;
  order(column: string, options: { ascending: boolean }): LooseDbQuery;
  range(from: number, to: number): LooseDbQuery;
  upsert(values: Record<string, unknown>, options: { onConflict: string }): LooseDbQuery;
  update(values: Record<string, unknown>): LooseDbQuery;
  eq(column: string, value: unknown): LooseDbQuery;
};
type LooseDbClient = { from(table: string): LooseDbQuery };

export function assertIndexNowUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("IndexNow URL must be an absolute canonical URL");
  }

  if (
    parsed.origin !== INDEXNOW_ORIGIN ||
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error("IndexNow URL must use the canonical Vidrial origin without parameters");
  }

  return parsed.toString();
}

export function fingerprintIndexNowUrl(url: string, revision: string): string {
  return createHash("sha256")
    .update(`${assertIndexNowUrl(url)}\n${revision}`)
    .digest("hex");
}

export function buildIndexNowBatches(urls: string[]): string[][] {
  const unique = [...new Set(urls.map(assertIndexNowUrl))].sort((a, b) => a.localeCompare(b));
  const batches: string[][] = [];
  for (let offset = 0; offset < unique.length; offset += MAX_BATCH_SIZE) {
    batches.push(unique.slice(offset, offset + MAX_BATCH_SIZE));
  }
  return batches;
}

export function createIndexNowPayload(urlList: string[]) {
  if (urlList.length === 0 || urlList.length > MAX_BATCH_SIZE) {
    throw new Error("IndexNow batches must contain between 1 and 10,000 URLs");
  }
  return {
    host: INDEXNOW_HOST,
    key: INDEXNOW_KEY,
    keyLocation: INDEXNOW_KEY_LOCATION,
    urlList: urlList.map(assertIndexNowUrl),
  };
}

export function classifyIndexNowResponse(status: number, attemptCount: number): IndexNowRetryState {
  if (status === 200 || status === 202) return "submitted";
  const retryable = status === 408 || status === 425 || status === 429 || status >= 500;
  if (retryable && attemptCount < MAX_ATTEMPTS) return "retryable";
  return "terminal";
}

export function isAuthorizedIndexNowRequest(request: Request, expectedSecret: string): boolean {
  if (expectedSecret.length < 32) return false;
  const authorization = request.headers.get("authorization");
  const candidate = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!candidate) return false;

  const expected = Buffer.from(expectedSecret);
  const supplied = Buffer.from(candidate);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

export function createIndexNowReconciler(dependencies: IndexNowDependencies) {
  return async (reason: IndexNowReason): Promise<IndexNowReconciliationResult> => {
    const [loadedCandidates, stored] = await Promise.all([
      dependencies.loadCandidates(),
      dependencies.store.list(),
    ]);
    const current = normalizeCandidates(loadedCandidates);
    const currentUrls = new Set(current.map((candidate) => candidate.url));
    const deletionCandidates = buildDeletionCandidates(stored, currentUrls);
    const candidates = normalizeCandidates([...current, ...deletionCandidates]);
    const storedByVersion = new Map(
      stored.map((record) => [`${record.url}\u0000${record.fingerprint}`, record]),
    );

    let unchanged = 0;
    let suppressedTerminal = 0;
    const pending: Array<{ candidate: IndexNowCandidate; attemptCount: number }> = [];
    for (const candidate of candidates) {
      const prior = storedByVersion.get(`${candidate.url}\u0000${candidate.fingerprint}`);
      if (prior?.retryState === "submitted") {
        unchanged += 1;
        continue;
      }
      if (prior?.retryState === "terminal") {
        suppressedTerminal += 1;
        continue;
      }
      const attemptCount = (prior?.attemptCount ?? 0) + 1;
      if (attemptCount > MAX_ATTEMPTS) {
        suppressedTerminal += 1;
        continue;
      }
      pending.push({ candidate, attemptCount });
    }

    const pendingByUrl = new Map(pending.map((entry) => [entry.candidate.url, entry]));
    const batches = buildIndexNowBatches(pending.map((entry) => entry.candidate.url));
    const totals = { submitted: 0, retryable: 0, terminal: suppressedTerminal };

    for (const batch of batches) {
      const entries = batch.map((url) => pendingByUrl.get(url)).filter(isPresent);
      await Promise.all(
        entries.map(({ candidate, attemptCount }) =>
          dependencies.store.recordAttempt(candidate, candidate.reason ?? reason, attemptCount),
        ),
      );

      let responseStatus: number | null = null;
      let requestFailed = false;
      try {
        const response = await fetchWithTimeout(
          dependencies.fetch,
          INDEXNOW_ENDPOINT,
          {
            method: "POST",
            headers: { "content-type": "application/json; charset=utf-8" },
            body: JSON.stringify(createIndexNowPayload(batch)),
          },
          dependencies.timeoutMs ?? REQUEST_TIMEOUT_MS,
        );
        responseStatus = response.status;
      } catch {
        requestFailed = true;
      }

      const completedAt = dependencies.now().toISOString();
      await Promise.all(
        entries.map(async ({ candidate, attemptCount }) => {
          const state = requestFailed
            ? attemptCount < MAX_ATTEMPTS
              ? "retryable"
              : "terminal"
            : classifyIndexNowResponse(responseStatus as number, attemptCount);
          totals[
            state === "submitted" ? "submitted" : state === "retryable" ? "retryable" : "terminal"
          ] += 1;
          await dependencies.store.recordResult(candidate, {
            responseStatus,
            retryState: state,
            attemptCount,
            submittedAt: state === "submitted" ? completedAt : null,
          });
        }),
      );
    }

    return {
      considered: candidates.length,
      unchanged,
      ...totals,
      batches: batches.length,
    };
  };
}

export async function reconcileIndexNow(
  reason: IndexNowReason,
): Promise<IndexNowReconciliationResult> {
  return createIndexNowReconciler({
    loadCandidates: loadPublishedIndexNowCandidates,
    store: createSupabaseIndexNowStore(),
    fetch,
    now: () => new Date(),
  })(reason);
}

export function createSupabaseIndexNowStore(): IndexNowStore {
  const client = getSupabaseAdminClient() as unknown as LooseDbClient;
  return {
    async list() {
      const pageSize = 1_000;
      const records: IndexNowStoredRecord[] = [];
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await client
          .from("indexnow_submissions")
          .select("url,fingerprint,reason,response_status,attempt_count,retry_state")
          .order("created_at", { ascending: false })
          .range(offset, offset + pageSize - 1);
        if (error || !Array.isArray(data)) throw new Error("IndexNow state could not be loaded");
        records.push(...data.map(parseStoredRecord));
        if (data.length < pageSize) return records;
      }
    },
    async recordAttempt(candidate, reason, attemptCount) {
      const timestamp = new Date().toISOString();
      const { error } = await client.from("indexnow_submissions").upsert(
        {
          url: candidate.url,
          fingerprint: candidate.fingerprint,
          reason,
          response_status: null,
          attempt_count: attemptCount,
          retry_state: "pending",
          last_attempt_at: timestamp,
          updated_at: timestamp,
        },
        { onConflict: "url,fingerprint" },
      );
      if (error) throw new Error("IndexNow attempt could not be recorded");
    },
    async recordResult(candidate, result) {
      const { error } = await client
        .from("indexnow_submissions")
        .update({
          response_status: result.responseStatus,
          attempt_count: result.attemptCount,
          retry_state: result.retryState,
          submitted_at: result.submittedAt,
          updated_at: new Date().toISOString(),
        })
        .eq("url", candidate.url)
        .eq("fingerprint", candidate.fingerprint);
      if (error) throw new Error("IndexNow result could not be recorded");
    },
  };
}

function loadPublishedIndexNowCandidates(): IndexNowCandidate[] {
  const articles = getPublishedArticles();
  const articleCandidates = articles.map((article) => {
    const url = new URL(article.canonicalPath, INDEXNOW_ORIGIN).toString();
    const revision = [article.updatedAt, article.title, article.description, article.body].join(
      "\n",
    );
    return { url, fingerprint: fingerprintIndexNowUrl(url, revision) };
  });
  const corpusRevision = articles
    .map((article) => [article.slug, article.updatedAt, article.title].join(":"))
    .join("\n");
  const blogUrl = new URL("/blog", INDEXNOW_ORIGIN).toString();
  const categories = new Map<string, string[]>();
  for (const article of articles) {
    const slug = blogCategorySlug(article.category);
    const revisions = categories.get(slug) ?? [];
    revisions.push([article.slug, article.updatedAt, article.title].join(":"));
    categories.set(slug, revisions);
  }
  const categoryCandidates = [...categories.entries()].map(([slug, revisions]) => {
    const url = new URL(`/blog/category/${slug}`, INDEXNOW_ORIGIN).toString();
    return { url, fingerprint: fingerprintIndexNowUrl(url, revisions.sort().join("\n")) };
  });
  return [
    { url: blogUrl, fingerprint: fingerprintIndexNowUrl(blogUrl, corpusRevision) },
    ...categoryCandidates,
    ...articleCandidates,
  ];
}

function normalizeCandidates(candidates: IndexNowCandidate[]): IndexNowCandidate[] {
  const byUrl = new Map<string, IndexNowCandidate>();
  for (const candidate of candidates) {
    const url = assertIndexNowUrl(candidate.url);
    if (!/^[a-f0-9]{64}$/.test(candidate.fingerprint)) {
      throw new Error("IndexNow fingerprint must be a lowercase SHA-256 value");
    }
    const normalized = { ...candidate, url };
    const prior = byUrl.get(url);
    if (prior && prior.fingerprint !== normalized.fingerprint) {
      throw new Error(`IndexNow received conflicting fingerprints for ${url}`);
    }
    byUrl.set(url, normalized);
  }
  return [...byUrl.values()].sort((a, b) => a.url.localeCompare(b.url));
}

function buildDeletionCandidates(
  stored: IndexNowStoredRecord[],
  currentUrls: Set<string>,
): IndexNowCandidate[] {
  const previouslySubmitted = new Set(
    stored
      .filter(
        (record) =>
          record.retryState === "submitted" &&
          (record.url === `${INDEXNOW_ORIGIN}/blog` ||
            record.url.startsWith(`${INDEXNOW_ORIGIN}/blog/`)),
      )
      .map((record) => record.url),
  );
  return [...previouslySubmitted]
    .filter((url) => !currentUrls.has(url))
    .map((url) => ({
      url,
      fingerprint: fingerprintIndexNowUrl(url, "deleted"),
      reason: "delete",
    }));
}

async function fetchWithTimeout(
  fetcher: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetcher(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function parseStoredRecord(value: unknown): IndexNowStoredRecord {
  if (typeof value !== "object" || value === null) throw new Error("IndexNow state was malformed");
  const row = value as Record<string, unknown>;
  const url = assertIndexNowUrl(String(row.url));
  const fingerprint = String(row.fingerprint);
  const attemptCount = Number(row.attempt_count);
  const retryState = String(row.retry_state) as IndexNowRetryState;
  const responseStatus = row.response_status === null ? null : Number(row.response_status);
  if (
    !/^[a-f0-9]{64}$/.test(fingerprint) ||
    !Number.isInteger(attemptCount) ||
    attemptCount < 0 ||
    attemptCount > MAX_ATTEMPTS ||
    !["pending", "submitted", "retryable", "terminal"].includes(retryState) ||
    (responseStatus !== null &&
      (!Number.isInteger(responseStatus) || responseStatus < 100 || responseStatus > 599))
  ) {
    throw new Error("IndexNow state was malformed");
  }
  return { url, fingerprint, attemptCount, retryState, responseStatus };
}

function isPresent<T>(value: T | undefined): value is T {
  return value !== undefined;
}
