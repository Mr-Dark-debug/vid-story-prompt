import { describe, expect, it, vi } from "vitest";
import type { Actor } from "./credential-service.server";
import { ChatError, type ChatStreamEvent } from "./chat-service.server";
import {
  CHAT_BODY_LIMIT_BYTES,
  handleChatRequest,
  isSameOrigin,
  sseFrame,
  type ChatRequestDeps,
} from "./chat-stream.server";

const actor: Actor = { userId: "u", workspaceId: "w" };
const threadId = "6f1c0a54-0000-4000-8000-000000000001";

function request(body: unknown, init: RequestInit & { headers?: Record<string, string> } = {}) {
  return new Request("https://vidrial.test/api/ai/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://vidrial.test",
      ...init.headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const valid = { threadId, turn: { kind: "send", content: "hello" } };

async function* events(list: ChatStreamEvent[]): AsyncGenerator<ChatStreamEvent> {
  for (const event of list) yield event;
}

/** An async iterator whose first step rejects, like a service failing its preconditions. */
function rejecting(error: Error): AsyncGenerator<ChatStreamEvent> {
  const iterator = {
    next: async () => {
      throw error;
    },
    return: async () => ({ done: true as const, value: undefined }),
    throw: async (cause: unknown) => {
      throw cause;
    },
    [Symbol.asyncIterator]() {
      return iterator;
    },
  };
  return iterator as unknown as AsyncGenerator<ChatStreamEvent>;
}

function deps(
  run: ChatRequestDeps["service"]["run"],
  extra: Partial<ChatRequestDeps> = {},
): ChatRequestDeps {
  return { authenticate: async () => actor, service: { run }, ...extra };
}

async function readAll(response: Response) {
  return await response.text();
}

describe("chat HTTP handler", () => {
  it("streams events as SSE with no-store, no-transform headers", async () => {
    const list: ChatStreamEvent[] = [
      { type: "start", threadId, userMessageId: "u1", assistantMessageId: "a1", title: "Hello" },
      { type: "delta", text: "Hi" },
      { type: "done", usage: { inputTokens: 1, outputTokens: 2 }, finishReason: "stop" },
    ];
    const run = vi.fn(() => events(list));
    const response = await handleChatRequest(request(valid), deps(run));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(response.headers.get("cache-control")).toContain("no-transform");
    expect(await readAll(response)).toBe(list.map(sseFrame).join(""));
    expect(run).toHaveBeenCalledWith(actor, threadId, valid.turn, expect.any(AbortSignal));
  });

  it("rejects cross-site, non-JSON, oversized, malformed and unauthenticated requests before running", async () => {
    const run = vi.fn(() => events([]));
    expect(
      (
        await handleChatRequest(
          request(valid, { headers: { origin: "https://evil.test" } }),
          deps(run),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await handleChatRequest(
          request(valid, { headers: { "content-type": "text/plain" } }),
          deps(run),
        )
      ).status,
    ).toBe(415);
    expect(
      (await handleChatRequest(request("x".repeat(CHAT_BODY_LIMIT_BYTES + 1)), deps(run))).status,
    ).toBe(413);
    expect((await handleChatRequest(request("{not json"), deps(run))).status).toBe(400);
    expect(
      (await handleChatRequest(request({ threadId: "nope", turn: valid.turn }), deps(run))).status,
    ).toBe(400);
    expect(
      (
        await handleChatRequest(
          request({ threadId, turn: { kind: "send", content: "" } }),
          deps(run),
        )
      ).status,
    ).toBe(400);
    expect(
      (await handleChatRequest(request(valid), { ...deps(run), authenticate: async () => null }))
        .status,
    ).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });

  it("maps precondition failures to HTTP statuses before streaming starts", async () => {
    const fail = (code: ConstructorParameters<typeof ChatError>[0]) => () =>
      rejecting(new ChatError(code, `problem ${code}`));
    for (const [code, status] of [
      ["not_found", 404],
      ["invalid_input", 400],
      ["no_model", 409],
      ["busy", 409],
      ["too_long", 413],
      ["limit", 429],
    ] as const) {
      const response = await handleChatRequest(request(valid), deps(fail(code)));
      expect(response.status).toBe(status);
      expect(await response.json()).toMatchObject({ code, error: `problem ${code}` });
    }
    // Unknown failures never leak their message.
    const crash = () => rejecting(new Error("db password is hunter2"));
    const response = await handleChatRequest(request(valid), deps(crash));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("hunter2");
  });

  it("settles the turn when the client cancels the stream", async () => {
    let cleaned = false;
    let sawAbort = false;
    const run = (_a: Actor, _t: string, _turn: unknown, signal?: AbortSignal) =>
      (async function* (): AsyncGenerator<ChatStreamEvent> {
        signal?.addEventListener("abort", () => (sawAbort = true));
        try {
          yield {
            type: "start",
            threadId,
            userMessageId: "u",
            assistantMessageId: "a",
            title: "t",
          };
          await new Promise(() => undefined); // provider is still talking
        } finally {
          cleaned = true; // the service's finally block would mark the reply interrupted here
        }
      })();
    const response = await handleChatRequest(request(valid), deps(run));
    const reader = response.body!.getReader();
    await reader.read(); // start event
    const pendingRead = reader.read(); // blocks on the next provider event
    await reader.cancel();
    void pendingRead.catch(() => undefined);
    await vi.waitFor(() => expect(cleaned).toBe(true));
    expect(sawAbort).toBe(true);
  });

  it("aborts the turn when the time cap is reached", async () => {
    let aborted = false;
    const run = (_a: Actor, _t: string, _turn: unknown, signal?: AbortSignal) =>
      (async function* (): AsyncGenerator<ChatStreamEvent> {
        yield { type: "start", threadId, userMessageId: "u", assistantMessageId: "a", title: "t" };
        await new Promise<void>((resolve) => signal?.addEventListener("abort", () => resolve()));
        aborted = true;
        yield { type: "settled", status: "interrupted" };
      })();
    const response = await handleChatRequest(request(valid), deps(run, { maxStreamMs: 20 }));
    const text = await readAll(response);
    expect(aborted).toBe(true);
    expect(text).toContain('"status":"interrupted"');
  });

  it("sends keep-alive comments while the provider is quiet", async () => {
    const run = () =>
      (async function* (): AsyncGenerator<ChatStreamEvent> {
        yield { type: "start", threadId, userMessageId: "u", assistantMessageId: "a", title: "t" };
        await new Promise((resolve) => setTimeout(resolve, 60));
        yield { type: "settled", status: "interrupted" };
      })();
    const text = await readAll(
      await handleChatRequest(request(valid), deps(run, { keepAliveMs: 10 })),
    );
    expect(text).toContain(": keep-alive");
  });

  it("checks origin from the Origin header, falling back to Fetch Metadata", () => {
    const base = "https://vidrial.test/api/ai/chat";
    expect(isSameOrigin(new Request(base, { headers: { origin: "https://vidrial.test" } }))).toBe(
      true,
    );
    expect(
      isSameOrigin(new Request(base, { headers: { origin: "https://vidrial.test.evil.io" } })),
    ).toBe(false);
    expect(isSameOrigin(new Request(base, { headers: { origin: "null" } }))).toBe(false);
    expect(isSameOrigin(new Request(base, { headers: { "sec-fetch-site": "cross-site" } }))).toBe(
      false,
    );
    expect(isSameOrigin(new Request(base, { headers: { "sec-fetch-site": "same-origin" } }))).toBe(
      true,
    );
  });
});
