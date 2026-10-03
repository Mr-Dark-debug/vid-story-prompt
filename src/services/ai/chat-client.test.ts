import { describe, expect, it } from "vitest";
import { ChatRequestError, streamChatTurn } from "./chat-client";
import { sseFrame } from "./chat-stream.server";
import type { ChatStreamEvent } from "./chat-service.server";

const start: ChatStreamEvent = {
  type: "start",
  threadId: "t",
  userMessageId: "u",
  assistantMessageId: "a",
  title: "Hello",
};

function streamingResponse(chunks: string[]) {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    }),
    { status: 200, headers: { "content-type": "text/event-stream" } },
  );
}

async function collect(iterable: AsyncIterable<ChatStreamEvent>) {
  const out: ChatStreamEvent[] = [];
  for await (const event of iterable) out.push(event);
  return out;
}

describe("chat client", () => {
  it("reassembles events split across arbitrary chunk boundaries and skips keep-alives", async () => {
    const frames = [
      sseFrame(start),
      ": keep-alive\n\n",
      sseFrame({ type: "delta", text: "héllo 👋" }),
      sseFrame({ type: "done", usage: { inputTokens: 1, outputTokens: 2 }, finishReason: "stop" }),
    ].join("");
    // Cut mid-frame, mid-JSON and even mid-multibyte-character.
    const bytes = new TextEncoder().encode(frames);
    const pieces = [bytes.slice(0, 7), bytes.slice(7, 90), bytes.slice(90, 112), bytes.slice(112)];
    const response = new Response(
      new ReadableStream({
        start(controller) {
          for (const piece of pieces) controller.enqueue(piece);
          controller.close();
        },
      }),
    );
    const events = await collect(
      streamChatTurn({
        threadId: "t",
        turn: { kind: "send", content: "hi" },
        fetcher: async () => response,
      }),
    );
    expect(events.map((e) => e.type)).toEqual(["start", "delta", "done"]);
    expect(events[1]).toEqual({ type: "delta", text: "héllo 👋" });
  });

  it("posts the turn as same-origin JSON", async () => {
    let seen: { url: string; init: RequestInit } | null = null;
    await collect(
      streamChatTurn({
        threadId: "thread-1",
        turn: { kind: "regenerate", assistantMessageId: "m9" },
        fetcher: async (url, init) => {
          seen = { url: String(url), init: init ?? {} };
          return streamingResponse([]);
        },
      }),
    );
    expect(seen!.url).toBe("/api/ai/chat");
    expect(seen!.init.credentials).toBe("same-origin");
    expect(JSON.parse(String(seen!.init.body))).toEqual({
      threadId: "thread-1",
      turn: { kind: "regenerate", assistantMessageId: "m9" },
    });
  });

  it("turns precondition failures into typed errors with the server's message", async () => {
    const error = await collect(
      streamChatTurn({
        threadId: "t",
        turn: { kind: "send", content: "hi" },
        fetcher: async () =>
          Response.json(
            { error: "This chat is still generating a reply.", code: "busy" },
            { status: 409 },
          ),
      }),
    ).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ChatRequestError);
    expect(error).toMatchObject({
      status: 409,
      code: "busy",
      message: "This chat is still generating a reply.",
    });

    const opaque = await collect(
      streamChatTurn({
        threadId: "t",
        turn: { kind: "send", content: "hi" },
        fetcher: async () => new Response("<html>bad gateway</html>", { status: 502 }),
      }),
    ).catch((caught: unknown) => caught);
    expect(opaque).toMatchObject({ status: 502, message: "The reply could not be started." });
  });

  it("stops reading when the caller aborts", async () => {
    const controller = new AbortController();
    const fetcher = (async (_url: unknown, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        );
      })) as typeof fetch;
    const run = collect(
      streamChatTurn({
        threadId: "t",
        turn: { kind: "send", content: "hi" },
        signal: controller.signal,
        fetcher,
      }),
    );
    controller.abort();
    await expect(run).rejects.toMatchObject({ name: "AbortError" });
  });
});
