// GENERATED from src/domain/ai by scripts/sync-worker-ai.mjs. Do not edit; run `npm run ai:sync`.
// Chat message lifecycle. The same transitions are enforced in the database by
// public.ai_chat_message_status_guard; message-state.test.ts fails if the two drift apart.

export const MESSAGE_STATUSES = [
  "pending",
  "streaming",
  "complete",
  "interrupted",
  "failed",
  "cancelled",
] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const MESSAGE_TRANSITIONS: Readonly<Record<MessageStatus, readonly MessageStatus[]>> =
  Object.freeze({
    pending: ["streaming", "complete", "failed", "cancelled"],
    streaming: ["complete", "interrupted", "failed", "cancelled"],
    // A dropped connection can be resumed (regenerated into the same slot) or settled.
    interrupted: ["streaming", "complete", "failed", "cancelled"],
    complete: [],
    failed: [],
    cancelled: [],
  });

export function canTransition(from: MessageStatus, to: MessageStatus): boolean {
  return from === to || MESSAGE_TRANSITIONS[from].includes(to);
}

export function isTerminal(status: MessageStatus): boolean {
  return MESSAGE_TRANSITIONS[status].length === 0;
}

/** A reply that is still being produced and so must not be sent back to a model as history. */
export function isInFlight(status: MessageStatus): boolean {
  return status === "pending" || status === "streaming";
}

/** An in-flight reply that has not been touched for this long was abandoned by its request. */
export const STALE_STREAM_SECONDS = 60;

export function isStale(status: MessageStatus, updatedAtMs: number, nowMs: number): boolean {
  return isInFlight(status) && nowMs - updatedAtMs > STALE_STREAM_SECONDS * 1_000;
}

export function canRegenerate(role: "user" | "assistant" | "system", status: MessageStatus) {
  return role === "assistant" && !isInFlight(status);
}

export function statusNotice(status: MessageStatus): string | null {
  switch (status) {
    case "interrupted":
      return "The connection dropped before this reply finished.";
    case "failed":
      return "This reply could not be completed.";
    case "cancelled":
      return "Stopped.";
    default:
      return null;
  }
}
