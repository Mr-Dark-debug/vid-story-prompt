import { describe, expect, it } from "vitest";
import { sourceRecoveryMessage } from "./source-copy";

describe("source recovery customer copy", () => {
  it.each([
    "provider_auth_challenge",
    "provider_rate_limited",
    "provider_temporary_failure",
    "video_restricted",
  ])("uses fixed actionable copy for %s", (code) => {
    expect(sourceRecoveryMessage(code)).toMatch(/Attach an authorised original/);
  });

  it("never exposes acquisition implementation vocabulary", () => {
    const copy = [
      sourceRecoveryMessage("provider_auth_challenge"),
      sourceRecoveryMessage("video_age_restricted"),
    ].join(" ");
    expect(copy).not.toMatch(/warp|cobalt|proxy|adapter|egress|ip address|stderr/i);
  });
});
