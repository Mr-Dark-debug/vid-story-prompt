// Pure state logic for the chat view: the reducer that folds stream events into messages, and
// thread-history grouping. No React, so every transition is unit-tested.
import type { MessageStatus } from "@/domain/ai/message-state";
import type { ChatStreamEvent } from "@/services/ai/chat-service.server";
import type { ChatMessageDto, ChatThreadSummary } from "@/services/ai/threads";

export type UiMessage = ChatMessageDto & {
  /** Provider-safe error copy for the current attempt; never persisted. */
  errorMessage?: string;
  /** True until the server confirms the real id. */
  local?: boolean;
};

export type ChatViewState = {
  messages: UiMessage[];
  /** Id of the assistant message currently receiving deltas, if any. */
  streamingId: string | null;
  title: string | null;
};

export type ChatAction =
  | { type: "hydrate"; messages: ChatMessageDto[] }
  | {
      type: "optimistic_turn";
      userMessage: { id: string; content: string } | null;
      assistantId: string;
      /** Remove this message and everything after it first (edit / regenerate). */
      truncateFromId?: string;
      providerId: string | null;
      modelId: string | null;
      now: string;
    }
  | { type: "event"; event: ChatStreamEvent }
  | { type: "request_failed"; message: string };

export const initialChatState: ChatViewState = { messages: [], streamingId: null, title: null };

const blank = (
  id: string,
  role: UiMessage["role"],
  content: string,
  status: MessageStatus,
  now: string,
): UiMessage => ({
  id,
  role,
  content,
  status,
  providerId: null,
  modelId: null,
  usageInputTokens: null,
  usageOutputTokens: null,
  errorCode: null,
  parentMessageId: null,
  createdAt: now,
  local: true,
});

function patch(messages: UiMessage[], id: string | null, update: Partial<UiMessage>): UiMessage[] {
  if (!id) return messages;
  return messages.map((message) => (message.id === id ? { ...message, ...update } : message));
}

export function chatReducer(state: ChatViewState, action: ChatAction): ChatViewState {
  switch (action.type) {
    case "hydrate":
      // Server state is authoritative whenever nothing is streaming locally.
      return state.streamingId
        ? state
        : { messages: action.messages, streamingId: null, title: state.title };

    case "optimistic_turn": {
      let messages = state.messages;
      if (action.truncateFromId) {
        const index = messages.findIndex((m) => m.id === action.truncateFromId);
        if (index >= 0) messages = messages.slice(0, index);
      }
      const added: UiMessage[] = [];
      if (action.userMessage) {
        added.push(
          blank(action.userMessage.id, "user", action.userMessage.content, "complete", action.now),
        );
      }
      added.push({
        ...blank(action.assistantId, "assistant", "", "streaming", action.now),
        providerId: action.providerId,
        modelId: action.modelId,
      });
      return { ...state, messages: [...messages, ...added], streamingId: action.assistantId };
    }

    case "event": {
      const { event } = action;
      switch (event.type) {
        case "start": {
          const streamingId = state.streamingId;
          const localUser = state.messages.find((m) => m.role === "user" && m.local);
          let messages = state.messages;
          if (localUser) {
            // The server may reuse an existing user message (regenerate); only rename local ones.
            messages = patch(messages, localUser.id, { id: event.userMessageId, local: false });
          }
          messages = patch(messages, streamingId, { id: event.assistantMessageId, local: false });
          return { messages, streamingId: event.assistantMessageId, title: event.title };
        }
        case "delta":
          return {
            ...state,
            messages: state.messages.map((m) =>
              m.id === state.streamingId ? { ...m, content: m.content + event.text } : m,
            ),
          };
        case "done":
          return {
            ...state,
            streamingId: null,
            messages: patch(state.messages, state.streamingId, {
              status: "complete",
              usageInputTokens: event.usage.inputTokens,
              usageOutputTokens: event.usage.outputTokens,
            }),
          };
        case "settled":
          return {
            ...state,
            streamingId: null,
            messages: patch(state.messages, state.streamingId, { status: event.status }),
          };
        case "error":
          return {
            ...state,
            streamingId: null,
            messages: patch(state.messages, state.streamingId, {
              status: event.status,
              errorCode: event.code,
              errorMessage: event.message,
            }),
          };
      }
      return state;
    }

    case "request_failed": {
      const streaming = state.messages.find((m) => m.id === state.streamingId);
      if (!streaming || streaming.local) {
        // The server never acknowledged the turn, so nothing was persisted: drop the placeholders.
        return { ...state, streamingId: null, messages: state.messages.filter((m) => !m.local) };
      }
      // The connection broke mid-reply; the server settles the row as interrupted too.
      return {
        ...state,
        streamingId: null,
        messages: patch(state.messages, state.streamingId, {
          status: "interrupted",
          errorMessage: action.message,
        }),
      };
    }
  }
}

/** The model badge appears when a reply came from a different model than the one before it. */
export function modelSwitchMarkers(messages: readonly UiMessage[]): Set<string> {
  const marked = new Set<string>();
  let previous: string | null = null;
  for (const message of messages) {
    if (message.role !== "assistant" || !message.modelId) continue;
    const key = `${message.providerId}::${message.modelId}`;
    if (previous !== null && previous !== key) marked.add(message.id);
    previous = key;
  }
  return marked;
}

export type ThreadGroup = { label: string; threads: ChatThreadSummary[] };

export function groupThreadsByDate(
  threads: readonly ChatThreadSummary[],
  now: Date = new Date(),
): ThreadGroup[] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = 86_400_000;
  const buckets: ThreadGroup[] = [
    { label: "Today", threads: [] },
    { label: "Yesterday", threads: [] },
    { label: "Previous 7 days", threads: [] },
    { label: "Previous 30 days", threads: [] },
    { label: "Older", threads: [] },
  ];
  for (const thread of threads) {
    const time = Date.parse(thread.lastMessageAt);
    const index =
      time >= startOfToday
        ? 0
        : time >= startOfToday - day
          ? 1
          : time >= startOfToday - 7 * day
            ? 2
            : time >= startOfToday - 30 * day
              ? 3
              : 4;
    buckets[index].threads.push(thread);
  }
  return buckets.filter((bucket) => bucket.threads.length > 0);
}

export function filterThreads(threads: readonly ChatThreadSummary[], query: string) {
  const needle = query.trim().toLowerCase();
  return needle ? threads.filter((thread) => thread.title.toLowerCase().includes(needle)) : threads;
}
