export interface MotionDraft {
  prompt: string;
  aspect: "16:9" | "1:1" | "9:16";
  durationSeconds: number;
  fps?: number;
  sourcePromptId?: string;
}

const PREFIX = "vidrial.motion.draft.";
const LATEST = `${PREFIX}latest`;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Private text stays in this tab. Only an opaque identifier enters auth redirects. */
export function saveMotionDraft(draft: MotionDraft): string {
  if (typeof window === "undefined") throw new Error("Drafts need a browser session.");
  if (!draft.prompt.trim() || draft.prompt.length > 12000)
    throw new Error("Enter a prompt of up to 12,000 characters.");
  const id = crypto.randomUUID();
  sessionStorage.setItem(`${PREFIX}${id}`, JSON.stringify({ draft, savedAt: Date.now() }));
  sessionStorage.setItem(LATEST, id);
  return id;
}

export function readMotionDraft(id?: string): MotionDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const key = id ?? sessionStorage.getItem(LATEST);
    if (!key || !/^[a-f0-9-]{36}$/i.test(key)) return null;
    const stored = sessionStorage.getItem(`${PREFIX}${key}`);
    if (!stored) return null;
    const { draft, savedAt } = JSON.parse(stored);
    if (!Number.isFinite(savedAt) || Date.now() - savedAt > MAX_AGE_MS || Date.now() < savedAt) {
      clearMotionDraft(key);
      return null;
    }
    if (
      typeof draft?.prompt !== "string" ||
      draft.prompt.length > 12000 ||
      !["16:9", "1:1", "9:16"].includes(draft.aspect) ||
      !Number.isFinite(draft.durationSeconds)
    )
      return null;
    return draft;
  } catch {
    return null;
  }
}

export function clearMotionDraft(id?: string): void {
  if (typeof window === "undefined") return;
  try {
    const key = id ?? sessionStorage.getItem(LATEST);
    if (key) sessionStorage.removeItem(`${PREFIX}${key}`);
    if (sessionStorage.getItem(LATEST) === key) sessionStorage.removeItem(LATEST);
  } catch {
    /* Storage may be disabled by the browser. */
  }
}
