import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.SUPABASE_URL = "https://worker-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "worker-test-service-role-key-long-enough";
});

import { TaskFailure } from "../domain/types.js";
import { CobaltClient } from "./cobalt-download.js";

const input = {
  apiKey: "cobalt-api-key-long-enough",
  apiUrl: "https://cobalt.example.test",
  directory: "/tmp/vidrial-cobalt-test",
  maximumDurationSeconds: 600,
  timeoutMs: 10_000,
  videoId: "dQw4w9WgXcQ",
};

describe("Cobalt download adapter", () => {
  it("uses the current POST / contract and API-Key authentication", async () => {
    const request = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "tunnel",
          url: "https://media.example.test/video.mp4",
          filename: "video.mp4",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const download = vi.fn().mockResolvedValue({ bytes: 1234, finalUrl: "https://media.example" });
    const client = new CobaltClient({ download, request });
    const result = await client.download(input);
    expect(result).toMatchObject({ bytes: 1234, format: "mp4", proxyTier: "cobalt" });
    expect(request).toHaveBeenCalledWith(
      "https://cobalt.example.test/",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Api-Key cobalt-api-key-long-enough",
          "user-agent": "Vidrial-Video-Worker/1.0",
        }),
      }),
    );
    const body = JSON.parse(String(request.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      videoQuality: "1080",
      youtubeVideoContainer: "mp4",
    });
  });

  it.each(["picker", "local-processing", "error"])(
    "rejects unsupported status %s",
    async (status) => {
      const client = new CobaltClient({
        request: vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ status, error: { code: "provider.failure" } }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        ),
      });
      await expect(client.download(input)).rejects.toBeInstanceOf(TaskFailure);
    },
  );

  it("rejects non-HTTPS returned media and embedded credentials", async () => {
    for (const url of ["http://127.0.0.1/private.mp4", "https://user:secret@media.test/a.mp4"]) {
      const client = new CobaltClient({
        request: vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ status: "redirect", url, filename: "a.mp4" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        ),
      });
      await expect(client.download(input)).rejects.toMatchObject({
        code: "cobalt_invalid_media_url",
      });
    }
  });

  it("applies a validated source section after bounded download", async () => {
    const runFfmpeg = vi.fn().mockResolvedValue(undefined);
    const client = new CobaltClient({
      download: vi.fn().mockResolvedValue({ bytes: 999, finalUrl: "https://media.test/a.mp4" }),
      request: vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: "redirect",
            url: "https://media.test/a.mp4",
            filename: "a.mp4",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
      runFfmpeg,
      statFile: vi.fn().mockResolvedValue({ size: 321 }),
    });
    const result = await client.download({
      ...input,
      section: { startSeconds: 30, endSeconds: 45 },
    });
    expect(runFfmpeg).toHaveBeenCalledWith(
      expect.arrayContaining(["-ss", "30", "-t", "15"]),
      expect.anything(),
    );
    expect(result).toMatchObject({ bytes: 321, sectionApplied: true });
  });

  it("opens a bounded circuit after repeated provider failures", async () => {
    const request = vi.fn().mockRejectedValue(new Error("network down"));
    let now = 1_000;
    const client = new CobaltClient({
      request,
      now: () => now,
      failureThreshold: 2,
      cooldownMs: 5000,
    });
    await expect(client.download(input)).rejects.toMatchObject({ code: "cobalt_unavailable" });
    await expect(client.download(input)).rejects.toMatchObject({ code: "cobalt_unavailable" });
    await expect(client.download(input)).rejects.toMatchObject({ code: "cobalt_circuit_open" });
    expect(request).toHaveBeenCalledTimes(2);
    now += 5001;
    await expect(client.download(input)).rejects.toMatchObject({ code: "cobalt_unavailable" });
    expect(request).toHaveBeenCalledTimes(3);
  });
});
