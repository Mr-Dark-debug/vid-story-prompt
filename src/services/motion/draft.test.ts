// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearMotionDraft, readMotionDraft, saveMotionDraft } from "./draft";

describe("private motion draft", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });
  it("roundtrips private text using an opaque identifier and removes consumed drafts", () => {
    const prompt = "A confidential product launch with exact copy";
    const id = saveMotionDraft({ prompt, aspect: "9:16", durationSeconds: 8 });
    expect(id).toMatch(/^[a-f0-9-]{36}$/);
    expect(id).not.toContain("confidential");
    expect(readMotionDraft(id)?.prompt).toBe(prompt);
    clearMotionDraft(id);
    expect(readMotionDraft(id)).toBeNull();
  });
  it("expires stale or malformed storage and never throws when storage is blocked", () => {
    const id = saveMotionDraft({ prompt: "Original idea", aspect: "16:9", durationSeconds: 8 });
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 25 * 60 * 60 * 1000);
    expect(readMotionDraft(id)).toBeNull();
    expect(readMotionDraft("../private")).toBeNull();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readMotionDraft()).toBeNull();
  });
});
