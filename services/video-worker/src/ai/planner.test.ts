import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.SUPABASE_URL = "https://worker-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "worker-test-service-role-key-long-enough";
});

import { planClips } from "./planner.js";

const transcript = "Why this matters because the result changes everything. ".repeat(120);

describe("clip planner", () => {
  it("uses bounded deterministic candidates when no provider is configured", async () => {
    const result = await planClips(
      { transcript, durationSeconds: 180, requestedClips: 3, instruction: "result" },
      undefined,
      { apiKey: "", model: "" },
    );
    expect(result.provider).toBe("deterministic");
    expect(result.candidates).toHaveLength(9);
    expect(result.candidates.every((candidate) => candidate.endSeconds <= 180)).toBe(true);
  });

  it("repairs one invalid response and falls back without unbounded retries", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: "not json" } }] }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }));
    const result = await planClips(
      { transcript, durationSeconds: 180, requestedClips: 2, instruction: "result" },
      undefined,
      { apiKey: "test-key", model: "test-model", fetcher },
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ provider: "deterministic", usedFallback: true });
    const secondRequest = JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body));
    expect(secondRequest.messages[0].content).toMatch(/not valid JSON/i);
    expect(String(secondRequest.messages[1].content).length).toBeLessThan(80_000);
  });
});
