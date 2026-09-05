import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("../config/env.js", () => ({
  env: {
    GROQ_API_KEY: "test-only-key",
    GROQ_TRANSCRIPTION_MODEL: "whisper-large-v3-turbo",
  },
}));
vi.mock("node:fs", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs")>();
  const openAsBlob = async () => new Blob(["audio"]);
  return { ...original, openAsBlob, default: { ...original, openAsBlob } };
});
import { transcribeWithFallback } from "./providers.js";

afterEach(() => vi.unstubAllGlobals());
describe("transcription fallback", () => {
  it("recovers a Turbo 500 using the full Groq model with timestamps", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 500 }))
      .mockResolvedValueOnce(
        Response.json({ text: "Hello", words: [{ word: "Hello", start: 0, end: 1 }] }),
      );
    vi.stubGlobal("fetch", fetcher);
    expect(await transcribeWithFallback("audio.flac")).toMatchObject({
      provider: "groq",
      model: "whisper-large-v3",
      words: [{ word: "Hello", start: 0, end: 1 }],
    });
    expect((fetcher.mock.calls[1][1].body as FormData).get("model")).toBe("whisper-large-v3");
  });
  it("does not switch Groq models on an account rate limit", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("{}", { status: 429 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(transcribeWithFallback("audio.flac")).rejects.toMatchObject({
      code: "rate_limit",
      retryable: true,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("does not hide invalid credentials with fallback attempts", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("{}", { status: 401 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(transcribeWithFallback("audio.flac")).rejects.toMatchObject({
      code: "transcription_rejected",
      retryable: false,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("preserves cancellation instead of making another provider request", async () => {
    const controller = new AbortController();
    const fetcher = vi.fn().mockImplementation(() => {
      controller.abort();
      throw controller.signal.reason;
    });
    vi.stubGlobal("fetch", fetcher);
    await expect(transcribeWithFallback("audio.flac", controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
