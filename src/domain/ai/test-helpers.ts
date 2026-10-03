// Test-only helpers (excluded from the worker copy).

export type RecordedCall = { url: string; init: RequestInit; headers: Headers; body: unknown };

export function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
    ...init,
  });
}

export function sseResponse(blocks: string[], init: ResponseInit = {}) {
  const encoder = new TextEncoder();
  // Split mid-event to prove the parser reassembles chunks.
  const text = blocks.join("");
  const midpoint = Math.floor(text.length / 2);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(text.slice(0, midpoint)));
      controller.enqueue(encoder.encode(text.slice(midpoint)));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
    ...init,
  });
}

export function sseBlock(data: unknown, event?: string) {
  const payload = typeof data === "string" ? data : JSON.stringify(data);
  return `${event ? `event: ${event}\n` : ""}data: ${payload}\n\n`;
}

/** Queues responses (or functions producing them) and records every request. */
export function mockFetch(
  queue: Array<Response | ((call: RecordedCall) => Response | Promise<Response>)>,
) {
  const calls: RecordedCall[] = [];
  const fetcher = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    const body = typeof init.body === "string" ? JSON.parse(init.body) : undefined;
    const call = { url: String(input), init, headers, body };
    calls.push(call);
    const next = queue.shift();
    if (!next) throw new Error(`Unexpected request to ${String(input)}`);
    return typeof next === "function" ? next(call) : next;
  }) as typeof fetch;
  return { fetcher, calls };
}

export async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of iterable) items.push(item);
  return items;
}

/** An SSE response the test drives by hand, to interleave events with stops and disconnects. */
export function controlledSse() {
  const encoder = new TextEncoder();
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  return {
    response: new Response(stream, {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    }),
    push(block: string) {
      controller.enqueue(encoder.encode(block));
    },
    close() {
      controller.close();
    },
    fail() {
      controller.error(new Error("socket reset"));
    },
  };
}
