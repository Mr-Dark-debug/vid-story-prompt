// HTTP layer for the interactive chat lane: validation, error mapping and SSE framing. It uses only
// Web-standard APIs (Response, ReadableStream, AbortController) so it behaves the same on the
// Vercel Node function and on the Cloudflare Worker fallback described in ARCHITECTURE.md.
import { z } from "zod";
import { AiServiceError, type Actor } from "./credential-service.server";
import { ChatError, type ChatService, type ChatStreamEvent } from "./chat-service.server";

export const CHAT_BODY_LIMIT_BYTES = 128 * 1024;
/** Stay below the platform's function limit so the reply settles as interrupted, not killed. */
export const CHAT_MAX_STREAM_MS = 270_000;
const KEEP_ALIVE_MS = 10_000;

const turnSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("send"), content: z.string().min(1).max(40_000) }),
  z.object({
    kind: z.literal("edit"),
    userMessageId: z.string().uuid(),
    content: z.string().min(1).max(40_000),
  }),
  z.object({ kind: z.literal("regenerate"), assistantMessageId: z.string().uuid() }),
]);

export const chatRequestSchema = z.object({ threadId: z.string().uuid(), turn: turnSchema });

function json(body: unknown, status: number, extra: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...extra } });
}

/** Cookie-authenticated POSTs must come from this site (defence in depth alongside SameSite). */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === new URL(request.url).host;
    } catch {
      return false;
    }
  }
  const site = request.headers.get("sec-fetch-site");
  return site === null || site === "same-origin" || site === "none";
}

const CHAT_ERROR_STATUS: Record<ChatError["code"], number> = {
  not_found: 404,
  invalid_input: 400,
  no_model: 409,
  busy: 409,
  too_long: 413,
  limit: 429,
};

export function sseFrame(event: ChatStreamEvent) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export type ChatRequestDeps = {
  authenticate: () => Promise<Actor | null>;
  service: Pick<ChatService, "run">;
  maxStreamMs?: number;
  keepAliveMs?: number;
};

export async function handleChatRequest(
  request: Request,
  deps: ChatRequestDeps,
): Promise<Response> {
  if (!isSameOrigin(request)) return json({ error: "Cross-site requests are not allowed." }, 403);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return json({ error: "Send JSON." }, 415);
  }
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > CHAT_BODY_LIMIT_BYTES) {
    return json({ error: "That request is too large." }, 413);
  }

  let body: z.infer<typeof chatRequestSchema>;
  try {
    const raw = await request.text();
    if (raw.length > CHAT_BODY_LIMIT_BYTES)
      return json({ error: "That request is too large." }, 413);
    const parsed = chatRequestSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return json({ error: "That request was not valid." }, 400);
    body = parsed.data;
  } catch {
    return json({ error: "That request was not valid." }, 400);
  }

  const actor = await deps.authenticate();
  if (!actor) return json({ error: "Sign in to use AI chat." }, 401);

  // One controller ends the turn on client disconnect, stream cancellation or the time cap.
  const controller = new AbortController();
  request.signal?.addEventListener("abort", () => controller.abort(), { once: true });
  const timeout = setTimeout(() => controller.abort(), deps.maxStreamMs ?? CHAT_MAX_STREAM_MS);

  const iterator = deps.service.run(actor, body.threadId, body.turn, controller.signal);
  let first: IteratorResult<ChatStreamEvent>;
  try {
    // Preconditions (ownership, model, busy thread) fail here, before any bytes are streamed.
    first = await iterator.next();
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof ChatError) {
      return json({ error: error.message, code: error.code }, CHAT_ERROR_STATUS[error.code]);
    }
    if (error instanceof AiServiceError) {
      return json({ error: error.message, code: error.code }, 409);
    }
    return json({ error: "The reply could not be started." }, 500);
  }

  const encoder = new TextEncoder();
  let pending: IteratorResult<ChatStreamEvent> | null = first;
  let keepAlive: ReturnType<typeof setInterval> | null = null;
  const finish = () => {
    clearTimeout(timeout);
    if (keepAlive) clearInterval(keepAlive);
  };

  const stream = new ReadableStream<Uint8Array>({
    start(streamController) {
      keepAlive = setInterval(() => {
        try {
          streamController.enqueue(encoder.encode(": keep-alive\n\n"));
        } catch {
          // The stream is closed; the interval is cleared in finish().
        }
      }, deps.keepAliveMs ?? KEEP_ALIVE_MS);
    },
    async pull(streamController) {
      try {
        const next = pending ?? (await iterator.next());
        pending = null;
        if (next.done) {
          finish();
          streamController.close();
          return;
        }
        streamController.enqueue(encoder.encode(sseFrame(next.value)));
      } catch {
        finish();
        // Errors are already reported as events and persisted; end the stream cleanly.
        streamController.close();
      }
    },
    async cancel() {
      // The client went away. Aborting makes the adapter stop; return() runs the generator's
      // finally block, which settles the message as interrupted with the text received so far.
      finish();
      controller.abort();
      await iterator.return(undefined);
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store, no-transform",
      "x-accel-buffering": "no",
      connection: "keep-alive",
    },
  });
}
