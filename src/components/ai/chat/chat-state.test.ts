import { describe, expect, it } from "vitest";
import type { ChatMessageDto, ChatThreadSummary } from "@/services/ai/threads";
import {
  chatReducer,
  filterThreads,
  groupThreadsByDate,
  initialChatState,
  modelSwitchMarkers,
  type ChatAction,
  type ChatViewState,
  type UiMessage,
} from "./chat-state";

const NOW = "2026-10-03T12:00:00.000Z";
const message = (
  id: string,
  role: "user" | "assistant",
  content: string,
  extra: Partial<ChatMessageDto> = {},
): ChatMessageDto => ({
  id,
  role,
  content,
  status: "complete",
  providerId: null,
  modelId: null,
  usageInputTokens: null,
  usageOutputTokens: null,
  errorCode: null,
  parentMessageId: null,
  createdAt: NOW,
  ...extra,
});

function run(actions: ChatAction[], from: ChatViewState = initialChatState) {
  return actions.reduce(chatReducer, from);
}

const optimistic: ChatAction = {
  type: "optimistic_turn",
  userMessage: { id: "local-u", content: "Pitch me" },
  assistantId: "local-a",
  providerId: "anthropic",
  modelId: "claude-opus-5",
  now: NOW,
};

describe("chat reducer", () => {
  it("shows the user message and an empty streaming reply immediately", () => {
    const state = run([optimistic]);
    expect(state.messages.map((m) => [m.id, m.role, m.status])).toEqual([
      ["local-u", "user", "complete"],
      ["local-a", "assistant", "streaming"],
    ]);
    expect(state.streamingId).toBe("local-a");
    expect(state.messages[1]).toMatchObject({ modelId: "claude-opus-5", providerId: "anthropic" });
  });

  it("swaps local ids for the server's, then accumulates deltas and finishes with usage", () => {
    const state = run([
      optimistic,
      {
        type: "event",
        event: {
          type: "start",
          threadId: "t",
          userMessageId: "u1",
          assistantMessageId: "a1",
          title: "Pitch me",
        },
      },
      { type: "event", event: { type: "delta", text: "Hel" } },
      { type: "event", event: { type: "delta", text: "lo" } },
      {
        type: "event",
        event: { type: "done", usage: { inputTokens: 5, outputTokens: 9 }, finishReason: "stop" },
      },
    ]);
    expect(state.title).toBe("Pitch me");
    expect(state.streamingId).toBeNull();
    expect(state.messages.map((m) => [m.id, m.local ?? false])).toEqual([
      ["u1", false],
      ["a1", false],
    ]);
    expect(state.messages[1]).toMatchObject({
      content: "Hello",
      status: "complete",
      usageInputTokens: 5,
      usageOutputTokens: 9,
    });
  });

  it("keeps partial text and records the status for stops, drops and failures", () => {
    const base = run([
      optimistic,
      {
        type: "event",
        event: {
          type: "start",
          threadId: "t",
          userMessageId: "u1",
          assistantMessageId: "a1",
          title: "x",
        },
      },
      { type: "event", event: { type: "delta", text: "partial" } },
    ]);
    const settled = (event: ChatAction) => chatReducer(base, event).messages[1];
    expect(
      settled({ type: "event", event: { type: "settled", status: "cancelled" } }),
    ).toMatchObject({ status: "cancelled", content: "partial" });
    expect(
      settled({ type: "event", event: { type: "settled", status: "interrupted" } }),
    ).toMatchObject({ status: "interrupted", content: "partial" });
    expect(
      settled({
        type: "event",
        event: { type: "error", code: "rate_limited", message: "Slow down", status: "interrupted" },
      }),
    ).toMatchObject({
      status: "interrupted",
      errorCode: "rate_limited",
      errorMessage: "Slow down",
      content: "partial",
    });
  });

  it("drops unacknowledged placeholders when the request is rejected up front", () => {
    const hydrated = run([
      {
        type: "hydrate",
        messages: [message("u0", "user", "old"), message("a0", "assistant", "older")],
      },
    ]);
    const state = run([optimistic, { type: "request_failed", message: "busy" }], hydrated);
    expect(state.messages.map((m) => m.id)).toEqual(["u0", "a0"]);
    expect(state.streamingId).toBeNull();
  });

  it("marks an acknowledged reply interrupted when the connection breaks mid-stream", () => {
    const state = run([
      optimistic,
      {
        type: "event",
        event: {
          type: "start",
          threadId: "t",
          userMessageId: "u1",
          assistantMessageId: "a1",
          title: "x",
        },
      },
      { type: "event", event: { type: "delta", text: "so far" } },
      { type: "request_failed", message: "Connection lost" },
    ]);
    expect(state.messages[1]).toMatchObject({
      status: "interrupted",
      content: "so far",
      errorMessage: "Connection lost",
    });
  });

  it("truncates from the edited or regenerated message before adding the new turn", () => {
    const hydrated = run([
      {
        type: "hydrate",
        messages: [
          message("u1", "user", "a"),
          message("a1", "assistant", "b"),
          message("u2", "user", "c"),
          message("a2", "assistant", "d"),
        ],
      },
    ]);
    const regenerate = chatReducer(hydrated, {
      ...optimistic,
      userMessage: null,
      truncateFromId: "a2",
    } as ChatAction);
    expect(regenerate.messages.map((m) => m.id)).toEqual(["u1", "a1", "u2", "local-a"]);
    const edit = chatReducer(hydrated, { ...optimistic, truncateFromId: "u2" } as ChatAction);
    expect(edit.messages.map((m) => m.id)).toEqual(["u1", "a1", "local-u", "local-a"]);
  });

  it("does not let a background refresh overwrite a reply that is streaming", () => {
    const streaming = run([optimistic]);
    expect(chatReducer(streaming, { type: "hydrate", messages: [] })).toBe(streaming);
  });
});

describe("model switch markers", () => {
  it("marks only replies from a different model than the previous reply", () => {
    const a = (id: string, modelId: string, providerId = "anthropic"): UiMessage => ({
      ...message(id, "assistant", "x", { modelId, providerId }),
    });
    const marked = modelSwitchMarkers([
      message("u", "user", "q"),
      a("1", "claude-opus-5"),
      a("2", "claude-opus-5"),
      a("3", "gpt-4o", "openai"),
      a("4", "gpt-4o", "openai"),
      a("5", "claude-opus-5"),
    ]);
    expect([...marked]).toEqual(["3", "5"]);
  });
});

describe("thread history", () => {
  const thread = (id: string, title: string, lastMessageAt: string): ChatThreadSummary => ({
    id,
    title,
    archivedAt: null,
    lastMessageAt,
    providerId: null,
    modelId: null,
    credentialId: null,
    clipJobId: null,
  });

  it("groups by local day buckets in recency order and omits empty groups", () => {
    const now = new Date(2026, 9, 3, 15, 0, 0); // local time
    const at = (daysAgo: number, hour = 9) => new Date(2026, 9, 3 - daysAgo, hour).toISOString();
    const groups = groupThreadsByDate(
      [
        thread("a", "Today", at(0)),
        thread("b", "Yday", at(1)),
        thread("c", "Week", at(5)),
        thread("d", "Month", at(20)),
        thread("e", "Old", at(90)),
        thread("f", "Today2", at(0, 1)),
      ],
      now,
    );
    expect(groups.map((g) => [g.label, g.threads.map((t) => t.id)])).toEqual([
      ["Today", ["a", "f"]],
      ["Yesterday", ["b"]],
      ["Previous 7 days", ["c"]],
      ["Previous 30 days", ["d"]],
      ["Older", ["e"]],
    ]);
    expect(groupThreadsByDate([thread("a", "x", at(0))], now).map((g) => g.label)).toEqual([
      "Today",
    ]);
  });

  it("searches titles case-insensitively", () => {
    const threads = [thread("a", "Hook ideas for ep 4", NOW), thread("b", "Caption rewrite", NOW)];
    expect(filterThreads(threads, "HOOK").map((t) => t.id)).toEqual(["a"]);
    expect(filterThreads(threads, "  ").length).toBe(2);
  });
});
