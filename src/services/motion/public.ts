import { listMotionPrompts, recordMotionPromptEvent } from "./server";
import { officialMotionPrompts, type PublicMotionPrompt } from "./catalog";
import { getCurrentSession } from "@/services/auth/server";

export async function motionStudioHandoff(draft: string) {
  const session = await getCurrentSession().catch(() => null);
  return session
    ? { to: "/app/motion/new" as const, search: { draft } }
    : {
        to: "/signup" as const,
        search: { redirect: `/app/motion/new?draft=${encodeURIComponent(draft)}` },
      };
}

export async function loadPublicMotionCatalog(): Promise<{
  prompts: PublicMotionPrompt[];
  databaseConnected: boolean;
}> {
  try {
    const rows = await listMotionPrompts({ data: { limit: 100, sort: "newest" } });
    // Seed rows supersede local authoring examples, so one piece never appears twice.
    const bySlug = new Map(officialMotionPrompts.map((p) => [p.slug, p]));
    for (const row of rows) bySlug.set(row.slug, { ...row, localOriginal: false });
    return { prompts: [...bySlug.values()], databaseConnected: true };
  } catch {
    return { prompts: officialMotionPrompts, databaseConnected: false };
  }
}

export async function recordPublicMotionEvent(
  prompt: PublicMotionPrompt,
  event: "view" | "copy" | "use" | "like",
): Promise<void> {
  if (prompt.localOriginal || typeof window === "undefined") return;
  const key = "vidrial.motion.metrics.session";
  let sessionId = sessionStorage.getItem(key);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(key, sessionId);
  }
  await recordMotionPromptEvent({ data: { promptId: prompt.id, event, sessionId } });
}
