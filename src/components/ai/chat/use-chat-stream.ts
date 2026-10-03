import { useCallback, useEffect, useReducer, useRef } from "react";
import { toast } from "sonner";
import { userFacingError } from "@/lib/user-facing-error";
import { ChatRequestError, streamChatTurn, type ChatTurn } from "@/services/ai/chat-client";
import { cancelChatMessage, type ChatMessageDto } from "@/services/ai/threads";
import { chatReducer, initialChatState, type ChatViewState, type UiMessage } from "./chat-state";

type Options = {
  threadId: string;
  serverMessages: ChatMessageDto[];
  providerId: string | null;
  modelId: string | null;
  /** Called after a turn settles so loaders can refresh from the server. */
  onSettled: () => void;
};

const STOP_GRACE_MS = 800;

export function useChatStream({
  threadId,
  serverMessages,
  providerId,
  modelId,
  onSettled,
}: Options) {
  const initial: ChatViewState = { ...initialChatState, messages: serverMessages };
  const [state, dispatch] = useReducer(chatReducer, initial);
  const controllerRef = useRef<AbortController | null>(null);
  const stateRef = useRef<ChatViewState>(state);
  stateRef.current = state;
  const settledRef = useRef(onSettled);
  settledRef.current = onSettled;

  useEffect(() => {
    dispatch({ type: "hydrate", messages: serverMessages });
  }, [serverMessages]);

  // Leaving the page ends the request; the server settles the reply as interrupted.
  useEffect(() => () => controllerRef.current?.abort(), []);

  const runTurn = useCallback(
    async (
      turn: ChatTurn,
      optimistic: {
        userContent: string | null;
        truncateFromId?: string;
      },
    ) => {
      const controller = new AbortController();
      controllerRef.current = controller;
      dispatch({
        type: "optimistic_turn",
        userMessage: optimistic.userContent
          ? { id: `local-user-${crypto.randomUUID()}`, content: optimistic.userContent }
          : null,
        assistantId: `local-assistant-${crypto.randomUUID()}`,
        truncateFromId: optimistic.truncateFromId,
        providerId,
        modelId,
        now: new Date().toISOString(),
      });
      try {
        for await (const event of streamChatTurn({ threadId, turn, signal: controller.signal })) {
          dispatch({ type: "event", event });
        }
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError") {
          // Stop was pressed (handled in stop()) or the page is closing.
          return;
        }
        const message =
          cause instanceof ChatRequestError
            ? cause.message
            : userFacingError(cause, "The connection to the reply was lost.");
        dispatch({ type: "request_failed", message });
        if (cause instanceof ChatRequestError) toast.error(message);
      } finally {
        if (controllerRef.current === controller) controllerRef.current = null;
        settledRef.current();
      }
    },
    [threadId, providerId, modelId],
  );

  const send = useCallback(
    (content: string) => runTurn({ kind: "send", content }, { userContent: content }),
    [runTurn],
  );

  const edit = useCallback(
    (message: UiMessage, content: string) =>
      runTurn(
        { kind: "edit", userMessageId: message.id, content },
        { userContent: content, truncateFromId: message.id },
      ),
    [runTurn],
  );

  const regenerate = useCallback(
    (message: UiMessage) =>
      runTurn(
        { kind: "regenerate", assistantMessageId: message.id },
        { userContent: null, truncateFromId: message.id },
      ),
    [runTurn],
  );

  const stop = useCallback(async () => {
    const controller = controllerRef.current;
    const current = stateRef.current;
    const streaming = current.messages.find((m) => m.id === current.streamingId);
    if (!controller) return;
    if (streaming && !streaming.local) {
      // Tell the server first so the reply settles as "cancelled", not "interrupted".
      await Promise.race([
        cancelChatMessage({ data: { threadId, messageId: streaming.id } }).catch(() => undefined),
        new Promise((resolve) => setTimeout(resolve, STOP_GRACE_MS)),
      ]);
    }
    controller.abort();
    dispatch({ type: "event", event: { type: "settled", status: "cancelled" } });
    settledRef.current();
  }, [threadId]);

  return {
    messages: state.messages,
    title: state.title,
    streaming: state.streamingId !== null,
    send,
    edit,
    regenerate,
    stop,
  };
}
