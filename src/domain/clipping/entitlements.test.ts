import { describe, expect, it } from "vitest";
import {
  evaluateConnectorEntitlement,
  evaluateJobEntitlement,
  getPlanEntitlement,
  requiresWatermark,
} from "./entitlements";
describe("plan entitlements", () => {
  it("checks full source limits separately from selected processing seconds", () => {
    const request = {
      plan: "free" as const,
      sourceSeconds: 600,
      requestedClips: 5,
      activeJobs: 0,
      reservedSeconds: 3550,
      committedSeconds: 0,
      processedSeconds: 50,
    };
    expect(evaluateJobEntitlement(request).allowed).toBe(true);
    expect(evaluateJobEntitlement({ ...request, sourceSeconds: 1801 }).reason).toBe(
      "source_too_long",
    );
    expect(evaluateJobEntitlement({ ...request, processedSeconds: 51 }).reason).toBe(
      "insufficient_usage",
    );
    expect(evaluateJobEntitlement({ ...request, sourceSeconds: Infinity }).reason).toBe(
      "invalid_duration",
    );
  });
  it("looks up canonical plans", () =>
    expect(getPlanEntitlement("free").monthlySourceSeconds).toBe(3600));
  it("rejects unknown plans", () => expect(() => getPlanEntitlement("enterprise")).toThrow());
  it("enforces source, clip, usage and concurrency limits", () => {
    expect(
      evaluateJobEntitlement({
        plan: "free",
        sourceSeconds: 1801,
        requestedClips: 5,
        activeJobs: 0,
        reservedSeconds: 0,
        committedSeconds: 0,
      }).reason,
    ).toBe("source_too_long");
    expect(
      evaluateJobEntitlement({
        plan: "free",
        sourceSeconds: 60,
        requestedClips: 6,
        activeJobs: 0,
        reservedSeconds: 0,
        committedSeconds: 0,
      }).reason,
    ).toBe("clip_limit");
    expect(
      evaluateJobEntitlement({
        plan: "free",
        sourceSeconds: 60,
        requestedClips: 5,
        activeJobs: 1,
        reservedSeconds: 0,
        committedSeconds: 0,
      }).reason,
    ).toBe("concurrent_job_limit");
    expect(
      evaluateJobEntitlement({
        plan: "free",
        sourceSeconds: 60,
        requestedClips: 5,
        activeJobs: 0,
        reservedSeconds: 3550,
        committedSeconds: 0,
      }).reason,
    ).toBe("insufficient_usage");
  });
  it("protects trial watermark state", () => {
    expect(requiresWatermark("free", 0)).toBe(false);
    expect(requiresWatermark("free", 1)).toBe(true);
    expect(requiresWatermark("creator", 100)).toBe(false);
  });
});

describe("connector entitlements", () => {
  it("enforces connection, automation, and S3 limits", () => {
    expect(
      evaluateConnectorEntitlement({
        plan: "free",
        connectorId: "google_drive",
        connectedAccounts: 1,
        automationRules: 0,
      }),
    ).toMatchObject({ allowed: false, reason: "connection_limit" });
    expect(
      evaluateConnectorEntitlement({
        plan: "creator",
        connectorId: "google_drive",
        connectedAccounts: 1,
        automationRules: 0,
        automationRequested: true,
      }).allowed,
    ).toBe(true);
    expect(
      evaluateConnectorEntitlement({
        plan: "creator",
        connectorId: "s3",
        connectedAccounts: 0,
        automationRules: 0,
      }),
    ).toMatchObject({ allowed: false, reason: "s3_requires_pro" });
  });
});
