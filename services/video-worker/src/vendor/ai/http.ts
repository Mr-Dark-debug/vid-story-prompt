// GENERATED from src/domain/ai by scripts/sync-worker-ai.mjs. Do not edit; run `npm run ai:sync`.
// Minimal fetch plumbing shared by every adapter. API keys only ever travel in request headers,
// and every error path is redacted before it can reach a log, response or database column.

import { AiProviderError, classifyHttpFailure, redactSecrets } from "./errors.js";

export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
export const DEFAULT_STREAM_IDLE_MS = 60_000;

export type ProviderRequest = {
  providerId: string;
  providerLabel: string;
  url: string;
  method?: "GET" | "POST";
  headers: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
  /** Time allowed until response headers arrive. */
  timeoutMs?: number;
  /** Exact secrets to scrub from any error text. */
  secrets: readonly string[];
  fetcher?: typeof fetch;
};

function abortedError(providerId: string) {
  return new AiProviderError(providerId, "aborted", "The request was stopped.");
}

/** Performs a request and throws a classified, redacted AiProviderError for any non-2xx result. */
export async function providerFetch(request: ProviderRequest): Promise<Response> {
  const fetcher = request.fetcher ?? fetch;
  if (request.signal?.aborted) throw abortedError(request.providerId);

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, request.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  request.signal?.addEventListener("abort", onAbort, { once: true });

  let response: Response;
  try {
    response = await fetcher(request.url, {
      method: request.method ?? (request.body === undefined ? "GET" : "POST"),
      headers: {
        ...(request.body === undefined ? {} : { "content-type": "application/json" }),
        ...request.headers,
      },
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
      signal: controller.signal,
      redirect: "error",
    });
  } catch {
    // The underlying error can mention the URL or headers; discard it entirely.
    if (request.signal?.aborted) throw abortedError(request.providerId);
    if (timedOut) {
      throw new AiProviderError(
        request.providerId,
        "timeout",
        `${request.providerLabel} did not respond in time.`,
      );
    }
    throw new AiProviderError(
      request.providerId,
      "network",
      `Could not reach ${request.providerLabel}.`,
    );
  } finally {
    clearTimeout(timer);
    request.signal?.removeEventListener("abort", onAbort);
  }

  if (!response.ok) {
    let body = "";
    try {
      body = (await response.text()).slice(0, 2_000);
    } catch {
      body = "";
    }
    throw classifyHttpFailure({
      providerId: request.providerId,
      providerLabel: request.providerLabel,
      status: response.status,
      body,
      retryAfter: response.headers.get("retry-after"),
      secrets: request.secrets,
    });
  }
  return response;
}

export async function readJson(
  response: Response,
  providerId: string,
  providerLabel: string,
): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new AiProviderError(
      providerId,
      "invalid_response",
      `${providerLabel} returned invalid JSON.`,
    );
  }
}

export type SseEvent = { event: string | null; data: string };

/**
 * Parses a Server-Sent Events body. Comment lines (OpenRouter keep-alives) are ignored, a trailing
 * partial event is flushed, and the stream is cancelled on abort or when it goes idle.
 */
export async function* readSse(
  response: Response,
  options: {
    providerId: string;
    providerLabel: string;
    signal?: AbortSignal;
    idleTimeoutMs?: number;
    secrets?: readonly string[];
  },
): AsyncGenerator<SseEvent> {
  if (!response.body) {
    throw new AiProviderError(
      options.providerId,
      "invalid_response",
      `${options.providerLabel} sent an empty stream.`,
    );
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const idleMs = options.idleTimeoutMs ?? DEFAULT_STREAM_IDLE_MS;
  let buffer = "";

  const readChunk = () =>
    new Promise<ReadableStreamReadResult<Uint8Array>>((resolve, reject) => {
      if (options.signal?.aborted) {
        reject(abortedError(options.providerId));
        return;
      }
      const cleanup = () => {
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", onAbort);
      };
      const onAbort = () => {
        cleanup();
        reject(abortedError(options.providerId));
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(
          new AiProviderError(
            options.providerId,
            "timeout",
            `${options.providerLabel} stopped sending data.`,
          ),
        );
      }, idleMs);
      options.signal?.addEventListener("abort", onAbort, { once: true });
      reader.read().then(
        (result) => {
          cleanup();
          resolve(result);
        },
        () => {
          cleanup();
          reject(
            new AiProviderError(
              options.providerId,
              "network",
              `The connection to ${options.providerLabel} was interrupted.`,
            ),
          );
        },
      );
    });

  const parseBlock = (block: string): SseEvent | null => {
    let event: string | null = null;
    const data: string[] = [];
    for (const line of block.split("\n")) {
      if (!line || line.startsWith(":")) continue;
      const separator = line.indexOf(":");
      const field = separator === -1 ? line : line.slice(0, separator);
      let value = separator === -1 ? "" : line.slice(separator + 1);
      if (value.startsWith(" ")) value = value.slice(1);
      if (field === "event") event = value;
      else if (field === "data") data.push(value);
    }
    return data.length ? { event, data: data.join("\n") } : null;
  };

  try {
    for (;;) {
      const { done, value } = await readChunk();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n?/g, "\n");
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const parsed = parseBlock(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        if (parsed) yield parsed;
        boundary = buffer.indexOf("\n\n");
      }
    }
    buffer += decoder.decode();
    const tail = parseBlock(buffer.replace(/\r\n?/g, "\n"));
    if (tail) yield tail;
  } finally {
    // Release the connection whether we finished, were stopped or errored.
    await reader.cancel().catch(() => undefined);
  }
}

/** Parses an SSE data payload, raising a redacted invalid_response error rather than leaking text. */
export function parseSseJson(data: string, providerId: string, providerLabel: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    throw new AiProviderError(
      providerId,
      "invalid_response",
      `${providerLabel} sent an unreadable stream event.`,
    );
  }
}

export function sanitizeForLog(text: string, secrets: readonly string[]) {
  return redactSecrets(text, secrets);
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Parses model text as JSON, tolerating a markdown fence, without echoing the text on failure. */
export function parseJsonText(text: string, providerId: string, providerLabel: string): unknown {
  const trimmed = text.trim();
  const unfenced = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
    : trimmed;
  try {
    return JSON.parse(unfenced);
  } catch {
    throw new AiProviderError(
      providerId,
      "invalid_response",
      `${providerLabel} did not return valid JSON.`,
    );
  }
}
