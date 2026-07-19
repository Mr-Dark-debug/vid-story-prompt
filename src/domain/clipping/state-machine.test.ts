import { describe, expect, it } from "vitest";
import { canTransitionJob, canTransitionTask } from "./state-machine";
import { backoffMilliseconds, isLeaseExpired, isRetryable } from "./retry";

describe("durable state transitions", () => {
  it("allows valid job flow and rejects jumps", () => {
    expect(canTransitionJob("queued", "validating")).toBe(true);
    expect(canTransitionJob("queued", "ready")).toBe(false);
    expect(canTransitionJob("partially_ready", "rendering_previews")).toBe(true);
  });

  it("allows jobs to wait for and resume from the local acquisition relay", () => {
    expect(canTransitionJob("awaiting_authorised_source", "awaiting_local_relay")).toBe(true);
    expect(canTransitionJob("awaiting_local_relay", "queued")).toBe(true);
    expect(canTransitionJob("awaiting_local_relay", "ready")).toBe(false);
  });

  it("allows retry task flow", () => {
    expect(canTransitionTask("running", "retry_wait")).toBe(true);
    expect(canTransitionTask("succeeded", "running")).toBe(false);
  });

  it("classifies retries and bounded jitter", () => {
    expect(isRetryable("rate_limit")).toBe(true);
    expect(isRetryable("invalid_media")).toBe(false);
    expect(backoffMilliseconds(1, 0)).toBe(750);
    expect(backoffMilliseconds(1, 1)).toBe(1250);
  });

  it("detects expired leases", () => {
    expect(isLeaseExpired("2020-01-01T00:00:00Z")).toBe(true);
    expect(isLeaseExpired(null)).toBe(false);
  });
});
