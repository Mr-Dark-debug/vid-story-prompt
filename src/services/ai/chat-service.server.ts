// Interactive chat lane. Orchestrates one turn: persist the user message, stream the provider's
// reply while checkpointing it, and always settle the assistant message in a truthful state.
//
// The request that drives this generator can disappear at any moment (client disconnect, function
// timeout). Correctness therefore never depends on the final write: partial text is checkpointed
// while streaming, the `finally` block settles the row if the consumer stops early, and a stale
// sweep (reconcileStale) settles anything an abandoned request left behind.

import { getAdapter } from "@/domain/ai/adapters";
import {
  buildChatContext,
  renderAttachment,
  titleFromMessage,
  type AttachmentInput,
  type ContextMessage,
} from "@/domain/ai/chat-context";
import { isAiProviderError, userMessageForAiError } from "@/domain/ai/errors";
import type { MessageStatus } from "@/domain/ai/message-state";
import { getAiProvider } from "@/domain/ai/providers";
import type { AdapterDeps, FinishReason, TokenUsage } from "@/domain/ai/types";
import { AiServiceError, type Actor, type CredentialService } from "./credential-service.server";

export { MAX_MESSAGE_CHARS } from "./limits";
import { MAX_MESSAGE_CHARS } from "./limits";
export const MAX_CONCURRENT_STREAMS = 4;
export const DEFAULT_OUTPUT_TOKENS = 4_096;
const CHECKPOINT_INTERVAL_MS = 1_500;
const CHECKPOINT_MIN_CHARS = 600;
// Well under the 60 s stale window, so a slow reasoning model is not mistaken for a dead request.
const HEARTBEAT_MS = 20_000;

export type ThreadRecord = {
  id: string;
  workspaceId: string;
  userId: string;
  title: string;
  credentialId: string | null;
  providerId: string | null;
  modelId: string | null;
  systemPrompt: string | null;
  clipJobId: string | null;
};

export type MessageRecord = {
  id: string;
  threadId: string;
  role: "user" | "assistant" | "system";
  content: string;
  status: MessageStatus;
  providerId: string | null;
  modelId: string | null;
  usageInputTokens: number | null;
  usageOutputTokens: number | null;
  finishReason: string | null;
  errorCode: string | null;
  parentMessageId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MessagePatch = Partial<{
  content: string;
  status: MessageStatus;
  usageInputTokens: number | null;
  usageOutputTokens: number | null;
  finishReason: FinishReason | null;
  errorCode: string | null;
  completedAt: string | null;
}>;

export interface ChatStore {
  getThread(id: string, actor: Actor): Promise<ThreadRecord | null>;
  listMessages(threadId: string, actor: Actor): Promise<MessageRecord[]>;
  insertMessage(row: {
    threadId: string;
    actor: Actor;
    role: "user" | "assistant";
    content: string;
    status: MessageStatus;
    providerId?: string | null;
    modelId?: string | null;
    parentMessageId?: string | null;
  }): Promise<MessageRecord>;
  /** Applies the patch only while the row is in one of `onlyWhen`; reports whether it applied. */
  updateMessage(
    id: string,
    patch: MessagePatch,
    onlyWhen: readonly MessageStatus[],
  ): Promise<boolean>;
  /** Hard-deletes the message and every later message in the thread. */
  deleteFrom(threadId: string, actor: Actor, messageId: string): Promise<void>;
  touchThread(id: string, patch: { title?: string }): Promise<void>;
  countInFlight(userId: string): Promise<number>;
  loadAttachment(thread: ThreadRecord): Promise<AttachmentInput | null>;
  modelLimits(
    credentialId: string,
    modelId: string,
  ): Promise<{ contextWindow: number | null; maxOutput: number | null } | null>;
  /** Settles in-flight replies untouched for `olderThanIso` as interrupted. */
  reconcileStale(threadId: string, actor: Actor, olderThanIso: string): Promise<number>;
}

export type ChatTurnInput =
  | { kind: "send"; content: string }
  | { kind: "edit"; userMessageId: string; content: string }
  | { kind: "regenerate"; assistantMessageId: string };

export type ChatStreamEvent =
  | {
      type: "start";
      threadId: string;
      userMessageId: string;
      assistantMessageId: string;
      title: string;
    }
  | { type: "delta"; text: string }
  | { type: "done"; usage: TokenUsage; finishReason: FinishReason }
  | { type: "settled"; status: "cancelled" | "interrupted" }
  | { type: "error"; code: string; message: string; status: "failed" | "interrupted" };

export class ChatError extends Error {
  readonly code: "not_found" | "no_model" | "invalid_input" | "busy" | "too_long" | "limit";
  constructor(code: ChatError["code"], message: string) {
    super(message);
    this.name = "ChatError";
    this.code = code;
  }
}

export type ChatServiceDeps = {
  store: ChatStore;
  credentials: Pick<CredentialService, "resolveKey" | "markInvalid">;
  adapters?: AdapterDeps;
  now?: () => number;
  checkpoint?: { intervalMs: number; minChars: number };
  /** Refreshes the row while a request is alive but silent; 0 disables it (tests). */
  heartbeatMs?: number;
};

export function createChatService(deps: ChatServiceDeps) {
  const now = deps.now ?? (() => Date.now());
  const checkpoint = deps.checkpoint ?? {
    intervalMs: CHECKPOINT_INTERVAL_MS,
    minChars: CHECKPOINT_MIN_CHARS,
  };
  const heartbeatMs = deps.heartbeatMs ?? HEARTBEAT_MS;
  const { store } = deps;

  async function prepare(actor: Actor, threadId: string, input: ChatTurnInput) {
    const thread = await store.getThread(threadId, actor);
    if (!thread) throw new ChatError("not_found", "That chat was not found.");
    if (!thread.credentialId || !thread.modelId || !thread.providerId) {
      throw new ChatError("no_model", "Choose a model for this chat first.");
    }
    // Replies abandoned by a dropped request must not block the thread forever.
    await store.reconcileStale(threadId, actor, new Date(now() - 60_000).toISOString());
    if ((await store.countInFlight(actor.userId)) >= MAX_CONCURRENT_STREAMS) {
      throw new ChatError("limit", "Too many replies are being generated. Wait for one to finish.");
    }
    const messages = await store.listMessages(threadId, actor);
    if (
      messages.some((message) => message.status === "pending" || message.status === "streaming")
    ) {
      throw new ChatError("busy", "This chat is still generating a reply.");
    }

    let userMessage: MessageRecord;
    if (input.kind === "send" || input.kind === "edit") {
      const content = input.content.trim();
      if (!content || content.length > MAX_MESSAGE_CHARS) {
        throw new ChatError(
          "invalid_input",
          `Messages must be between 1 and ${MAX_MESSAGE_CHARS.toLocaleString("en")} characters.`,
        );
      }
      if (input.kind === "edit") {
        const edited = messages.find((m) => m.id === input.userMessageId && m.role === "user");
        if (!edited) throw new ChatError("not_found", "That message was not found.");
        await store.deleteFrom(threadId, actor, edited.id);
      }
      userMessage = await store.insertMessage({
        threadId,
        actor,
        role: "user",
        content,
        status: "complete",
      });
    } else {
      const index = messages.findIndex(
        (m) => m.id === input.assistantMessageId && m.role === "assistant",
      );
      if (index < 0) throw new ChatError("not_found", "That reply was not found.");
      const answered = messages
        .slice(0, index)
        .reverse()
        .find((m) => m.role === "user");
      if (!answered) throw new ChatError("not_found", "There is no question to answer again.");
      await store.deleteFrom(threadId, actor, messages[index].id);
      userMessage = answered;
    }
    return { thread, userMessage };
  }

  /** Runs one turn, yielding stream events. Safe to abandon: the finally block settles the row. */
  async function* run(
    actor: Actor,
    threadId: string,
    input: ChatTurnInput,
    signal?: AbortSignal,
  ): AsyncGenerator<ChatStreamEvent> {
    const { thread, userMessage } = await prepare(actor, threadId, input);
    const providerId = thread.providerId!;
    const modelId = thread.modelId!;
    const providerLabel = getAiProvider(providerId)?.label ?? providerId;

    const assistant = await store.insertMessage({
      threadId,
      actor,
      role: "assistant",
      content: "",
      status: "streaming",
      providerId,
      modelId,
      parentMessageId: userMessage.id,
    });
    const isFirstTurn = thread.title === "New chat" && input.kind !== "regenerate";
    const title = isFirstTurn ? titleFromMessage(userMessage.content) : thread.title;
    if (isFirstTurn) await store.touchThread(threadId, { title });
    yield {
      type: "start",
      threadId,
      userMessageId: userMessage.id,
      assistantMessageId: assistant.id,
      title,
    };

    let content = "";
    let savedLength = 0;
    let lastSave = now();
    let usage: TokenUsage = { inputTokens: null, outputTokens: null };
    let finish: FinishReason = "stop";
    let settled = false;

    const settle = async (patch: MessagePatch) => {
      settled = true;
      const applied = await store.updateMessage(
        assistant.id,
        { ...patch, content, completedAt: new Date(now()).toISOString() },
        ["pending", "streaming", "interrupted"],
      );
      // Stop already moved the row to cancelled; still keep everything received after the last
      // checkpoint. Content edits are not status changes, so the database permits them.
      if (!applied) await store.updateMessage(assistant.id, { content }, ["cancelled"]);
      return applied;
    };

    const heartbeat =
      heartbeatMs > 0
        ? setInterval(() => {
            void store.updateMessage(assistant.id, { content }, ["streaming"]).catch(() => false);
          }, heartbeatMs)
        : null;

    try {
      const key = await deps.credentials.resolveKey({
        ...actor,
        credentialId: thread.credentialId!,
      });
      const limits = await store.modelLimits(thread.credentialId!, modelId);
      const maxOutputTokens = Math.min(
        limits?.maxOutput ?? DEFAULT_OUTPUT_TOKENS,
        DEFAULT_OUTPUT_TOKENS * 2,
      );
      const attachmentInput = await store.loadAttachment(thread);
      const history: ContextMessage[] = (await store.listMessages(threadId, actor))
        .filter((m) => m.id !== assistant.id)
        .map((m) => ({ role: m.role, content: m.content, status: m.status }));
      const context = buildChatContext({
        history,
        systemPrompt: thread.systemPrompt,
        attachment: attachmentInput ? renderAttachment(attachmentInput) : null,
        contextWindow: limits?.contextWindow ?? null,
        maxOutputTokens,
      });
      if (!context.ok) {
        throw new ChatError("too_long", userMessageForAiError("context_length", providerLabel));
      }

      for await (const delta of getAdapter(providerId, deps.adapters).streamChat({
        apiKey: key.apiKey,
        modelId,
        messages: context.messages,
        maxOutputTokens,
        signal,
      })) {
        if (delta.type === "text") {
          content += delta.text;
          yield { type: "delta", text: delta.text };
          if (
            now() - lastSave >= checkpoint.intervalMs ||
            content.length - savedLength >= checkpoint.minChars
          ) {
            await store.updateMessage(assistant.id, { content }, ["streaming"]);
            savedLength = content.length;
            lastSave = now();
          }
        } else if (delta.type === "usage") {
          usage = delta.usage;
        } else {
          finish = delta.reason;
        }
      }

      const applied = await settle({
        status: "complete",
        usageInputTokens: usage.inputTokens,
        usageOutputTokens: usage.outputTokens,
        finishReason: finish,
        errorCode: null,
      });
      // False means the user pressed Stop while the last chunk was in flight.
      yield applied
        ? { type: "done", usage, finishReason: finish }
        : { type: "settled", status: "cancelled" };
    } catch (error) {
      if (isAiProviderError(error) && error.code === "aborted") {
        // Stop sets "cancelled" first; a bare disconnect leaves the row for us to mark interrupted.
        const applied = await settle({ status: "interrupted", errorCode: null });
        yield { type: "settled", status: applied ? "interrupted" : "cancelled" };
        return;
      }
      let code = "bad_request";
      let message = "The reply could not be completed.";
      if (isAiProviderError(error)) {
        code = error.code;
        message = userMessageForAiError(error.code, providerLabel);
        if (error.invalidatesCredential) {
          await deps.credentials.markInvalid({
            ...actor,
            credentialId: thread.credentialId!,
            code,
          });
        }
      } else if (error instanceof AiServiceError) {
        code = error.code;
        message = error.message;
      } else if (error instanceof ChatError) {
        code = error.code;
        message = error.message;
      }
      // Partial text after a transient failure can be retried; anything else is final.
      const transient = isAiProviderError(error) && error.retryable && content.trim().length > 0;
      const status = transient ? "interrupted" : "failed";
      await settle({ status, errorCode: code.slice(0, 64) });
      yield { type: "error", code, message, status };
    } finally {
      if (heartbeat) clearInterval(heartbeat);
      if (!settled) {
        // The consumer stopped iterating (disconnect): keep what we have and mark it interrupted.
        await settle({ status: "interrupted" }).catch(() => false);
      }
    }
  }

  return {
    run,

    /** Stop button: settles the reply as cancelled, keeping the partial text already saved. */
    async cancel(actor: Actor, threadId: string, messageId: string) {
      const messages = await store.listMessages(threadId, actor);
      const target = messages.find((m) => m.id === messageId && m.role === "assistant");
      if (!target) throw new ChatError("not_found", "That reply was not found.");
      const applied = await store.updateMessage(
        target.id,
        { status: "cancelled", completedAt: new Date(now()).toISOString() },
        ["pending", "streaming", "interrupted"],
      );
      return { cancelled: applied };
    },

    reconcileStale(actor: Actor, threadId: string) {
      return store.reconcileStale(threadId, actor, new Date(now() - 60_000).toISOString());
    },
  };
}

export type ChatService = ReturnType<typeof createChatService>;
