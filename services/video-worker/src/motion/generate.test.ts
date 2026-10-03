import { describe, expect, it, vi } from "vitest";
import { generateScene } from "./generate.js";
import { critiqueScene } from "./critique.js";
import { resolveAiCredential, type MotionAiAdapter } from "./provider.js";
const spec = {
  width: 320,
  height: 180,
  fps: 24 as const,
  durationSeconds: 1,
  aspect: "16:9" as const,
};
const html = `<html><script>window.DURATION=1;window.seek=async t=>{document.body.textContent='Exact 12';};</script></html>`;
const brief = {
  story: "Original",
  beats: [{ time: 0, description: "Open" }],
  keyframes: [0, 1 / 3, 2 / 3, 1].map((time) => ({ time, description: "Frame" })),
};
function adapter() {
  return {
    completeJson: vi
      .fn()
      .mockResolvedValue({ value: brief, modelUsed: "fixture-model", tokensUsed: 7 }),
    completeText: vi
      .fn()
      .mockResolvedValue({ text: html, modelUsed: "fixture-model", tokensUsed: 11 }),
  } satisfies MotionAiAdapter;
}
describe("explicit mocked model boundary", () => {
  it("repairs lint errors once and records actual call token usage", async () => {
    const ai = adapter();
    ai.completeText.mockResolvedValueOnce({
      text: html.replace("window.seek", "setInterval(()=>{},1);window.seek"),
      modelUsed: "fixture-model",
      tokensUsed: 3,
    });
    const result = await generateScene(
      { prompt: "Exact 12", spec },
      ai,
      new AbortController().signal,
    );
    expect(result.lintReport.ok).toBe(true);
    expect(result.repairAttempts).toBe(1);
    expect(result.tokensUsed).toBe(21);
    expect(ai.completeText).toHaveBeenCalledTimes(2);
  });
  it("never returns repeated unsafe model repairs", async () => {
    const ai = adapter();
    ai.completeText.mockResolvedValue({
      text: html.replace("window.seek", "fetch('https://example.com');window.seek"),
      modelUsed: "fixture-model",
      tokensUsed: 3,
    });
    await expect(
      generateScene({ prompt: "Exact 12", spec }, ai, new AbortController().signal),
    ).rejects.toThrow("motion_lint_failed");
    expect(ai.completeText).toHaveBeenCalledTimes(3);
  });
  it("requires provider flag, credentials and allowlisted model", () => {
    expect(() =>
      resolveAiCredential({
        enabled: false,
        allowedModels: ["a"],
        modelId: "a",
        platformKey: "key",
      }),
    ).toThrow();
    expect(() =>
      resolveAiCredential({
        enabled: true,
        allowedModels: ["a"],
        modelId: "b",
        platformKey: "key",
      }),
    ).toThrow();
  });
  it("critiques the delivered repair using four labelled actual image buffers", async () => {
    const ai = adapter();
    ai.completeJson
      .mockResolvedValueOnce({
        value: {
          issues: [{ code: "legibility", description: "Larger text" }],
          instruction: "Preserve Exact 12",
        },
        modelUsed: "fixture-model",
        tokensUsed: 2,
      })
      .mockResolvedValueOnce({
        value: { issues: [], instruction: "" },
        modelUsed: "fixture-model",
        tokensUsed: 3,
      });
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const frames = vi.fn().mockResolvedValue([png, png, png, png]);
    const result = await critiqueScene(
      { prompt: "Exact 12", spec },
      {
        htmlSource: html,
        lintReport: { ok: true, errors: [], warnings: [] },
        modelUsed: "fixture-model",
        tokensUsed: 1,
      },
      ai,
      new AbortController().signal,
      frames,
    );
    expect(result.critiqueReport).toEqual({ rounds: 2, issues: [], resolved: true });
    expect(result.tokensUsed).toBe(17);
    expect(frames).toHaveBeenCalledTimes(2);
  });
  it("retains passing scene when critique returns an unsafe repair", async () => {
    const ai = adapter();
    ai.completeJson.mockResolvedValue({
      value: { issues: [{ code: "legibility", description: "Larger text" }], instruction: "" },
      modelUsed: "fixture-model",
      tokensUsed: 2,
    });
    ai.completeText.mockResolvedValue({
      text: "<script>eval('1')</script>",
      modelUsed: "fixture-model",
      tokensUsed: 3,
    });
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const result = await critiqueScene(
      { prompt: "Exact 12", spec },
      {
        htmlSource: html,
        lintReport: { ok: true, errors: [], warnings: [] },
        modelUsed: "fixture-model",
        tokensUsed: 1,
      },
      ai,
      new AbortController().signal,
      async () => [png, png, png, png],
    );
    expect(result.htmlSource).toBe(html);
    expect(result.critiqueReport.resolved).toBe(false);
  });
});
