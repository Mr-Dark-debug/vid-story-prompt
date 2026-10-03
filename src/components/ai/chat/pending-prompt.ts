// Hands the first message of a brand-new chat from the "new chat" screen to the thread route.
// Both are client-side navigations, so a module-level map is enough and needs no storage.
const pending = new Map<string, string>();

export function stashPendingPrompt(threadId: string, content: string) {
  pending.set(threadId, content);
}

/** Returns the stashed prompt once; later calls return null. */
export function takePendingPrompt(threadId: string): string | null {
  const content = pending.get(threadId) ?? null;
  pending.delete(threadId);
  return content;
}
