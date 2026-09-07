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

  it.each([
    ["provider_rate_limited", /limited the number of requests/],
    ["provider_temporary_failure", /timed out/],
    ["provider_access_denied", /HTTP 403.*cause is not confirmed/],
    ["provider_unknown_failure", /unrecognized reason/],
    ["video_private", /video is private/],
    ["video_age_restricted", /age-restricted/],
    ["video_region_restricted", /worker's region/],
    ["video_unavailable", /removed/],
  ])("preserves the specific safe reason for %s", (code, expected) => {
    expect(sourceRecoveryMessage(code)).toMatch(expected);
  });

  it("does not claim every configured option was attempted or promise OAuth recovery", () => {
    expect(sourceRecoveryMessage("provider_auth_challenge")).toContain(
      "does not unlock this download",
    );
    expect(sourceRecoveryMessage("provider_unknown_failure")).not.toMatch(
      /every safe connection|IP block confirmed/,
    );
  });
});
