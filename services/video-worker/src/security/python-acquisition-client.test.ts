import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.SUPABASE_URL = "https://worker-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "worker-test-service-role-key-long-enough";
});
import { TaskFailure } from "../domain/types.js";
import { downloadYouTubeWithPython, type PythonAcquisitionInput } from "./python-acquisition-client.js";

const inputFor = (directory: string): PythonAcquisitionInput => ({
  requestId: "python_request_123456789",
  jobId: "11111111-1111-4111-8111-111111111111",
  taskId: "22222222-2222-4222-8222-222222222222",
  videoId: "dQw4w9WgXcQ",
  directory,
  maximumDurationSeconds: 600,
  maximumHeight: 720,
  outputFormat: "mp4",
  strategy: "standard",
  proxy: { tier: "warp", url: "http://127.0.0.1:8080" },
  section: { startSeconds: 30, endSeconds: 45 },
});

describe("Python acquisition client", () => {
  it("submits plan-capped asynchronous work and validates the local result", async () => {
    const directory = await mkdtemp(join(tmpdir(), "vidrial-python-client-"));
    const filename = join(directory, "yt-source.mp4");
    await writeFile(filename, "video");
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ request_id: "python_request_123456789", state: "accepted" }), {
          status: 202,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            request_id: "python_request_123456789",
            state: "completed",
            result: { bytes: 5, filename, format: "mp4", section_applied: true },
          }),
        ),
      );

    const result = await downloadYouTubeWithPython(inputFor(directory), undefined, {
      baseUrl: "http://127.0.0.1:8090",
      fetchImpl,
      pollMs: 1,
      token: "test-token-long-enough",
    });

    expect(result).toMatchObject({ bytes: 5, proxyTier: "warp", sectionApplied: true });
    const submitted = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
    expect(submitted).toMatchObject({
      maximum_height: 720,
      output_format: "mp4",
      proxy_url: "http://127.0.0.1:8080",
      source_section: { start_seconds: 30, end_seconds: 45 },
    });
    expect(fetchImpl.mock.calls[0]?.[1]?.headers).toMatchObject({
      authorization: "Bearer test-token-long-enough",
    });
  });

  it("converts a typed Python failure without leaking diagnostics", async () => {
    const directory = await mkdtemp(join(tmpdir(), "vidrial-python-client-"));
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          request_id: "python_request_123456789",
          state: "failed",
          error_code: "provider_auth_challenge",
          error_message: "YouTube blocked this request from the server network.",
          retryable: true,
        }),
        { status: 202 },
      ),
    );
    await expect(
      downloadYouTubeWithPython(inputFor(directory), undefined, {
        baseUrl: "http://127.0.0.1:8090",
        fetchImpl,
        token: "test-token-long-enough",
      }),
    ).rejects.toMatchObject({ code: "provider_auth_challenge", retryable: true });
  });

  it("rejects a returned path outside the isolated attempt directory", async () => {
    const directory = await mkdtemp(join(tmpdir(), "vidrial-python-client-"));
    const outside = join(directory, "..", "escaped.mp4");
    await writeFile(outside, "video");
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          request_id: "python_request_123456789",
          state: "completed",
          result: { bytes: 5, filename: outside, format: "mp4", section_applied: false },
        }),
      ),
    );
    const promise = downloadYouTubeWithPython(inputFor(directory), undefined, {
      baseUrl: "http://127.0.0.1:8090",
      fetchImpl,
      token: "test-token-long-enough",
    });
    await expect(promise).rejects.toBeInstanceOf(TaskFailure);
    await expect(promise).rejects.toMatchObject({ code: "invalid_output_path" });
  });

  it("sends cancellation to the Python service", async () => {
    const directory = await mkdtemp(join(tmpdir(), "vidrial-python-client-"));
    const controller = new AbortController();
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      if (init?.method === "POST") controller.abort();
      return new Response(
        JSON.stringify({ request_id: "python_request_123456789", state: "accepted" }),
        { status: 202 },
      );
    });
    await expect(
      downloadYouTubeWithPython(inputFor(directory), controller.signal, {
        baseUrl: "http://127.0.0.1:8090",
        fetchImpl,
        pollMs: 1,
        token: "test-token-long-enough",
      }),
    ).rejects.toMatchObject({ code: "cancelled" });
    expect(fetchImpl.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(true);
  });
});
