// Browser client for the streaming chat endpoint. Parses Server-Sent Events from a fetch body;
// no credentials or provider details ever pass through here.
import type { ChatStreamEvent } from "./chat-service.server";

export type ChatTurn =
  | { kind: "send"; content: string }
  | { kind: "edit"; userMessageId: string; content: string }
  | { kind: "regenerate"; assistantMessageId: string };

export class ChatRequestError extends Error {
  readonly status: number;
  readonly code: string | null;
  constructor(message: string, status: number, code: string | null) {
    super(message);
    this.name = "ChatRequestError";
    this.status = status;
    this.code = code;
  }
}

function parseFrame(frame: string): ChatStreamEvent | null {
  const data = frame
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).replace(/^ /, ""))
    .join("\n");
  if (!data) return null; // comment-only frames (keep-alives)
  try {
    return JSON.parse(data) as ChatStreamEvent;
  } catch {
    return null;
  }
}

/** Streams one chat turn. Aborting `signal` stops reading and closes the connection. */
export async function* streamChatTurn(options: {
  threadId: string;
  turn: ChatTurn;
  signal?: AbortSignal;
  fetcher?: typeof fetch;
}): AsyncGenerator<ChatStreamEvent> {
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher("/api/ai/chat", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "text/event-stream" },
    credentials: "same-origin",
    body: JSON.stringify({ threadId: options.threadId, turn: options.turn }),
    signal: options.signal,
  });
  if (!response.ok) {
    let message = "The reply could not be started.";
    let code: string | null = null;
    try {
      const body = (await response.json()) as { error?: unknown; code?: unknown };
      if (typeof body.error === "string") message = body.error;
      if (typeof body.code === "string") code = body.code;
    } catch {
      // Keep the generic message.
    }
    throw new ChatRequestError(message, response.status, code);
  }
  if (!response.body) throw new ChatRequestError("The reply stream was empty.", 502, null);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n?/g, "\n");
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const event = parseFrame(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        if (event) yield event;
        boundary = buffer.indexOf("\n\n");
      }
    }
    const tail = parseFrame(buffer);
    if (tail) yield tail;
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}
