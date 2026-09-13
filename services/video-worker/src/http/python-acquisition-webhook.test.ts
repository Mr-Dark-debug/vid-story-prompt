import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  pythonAcquisitionEventCopy,
  verifyPythonAcquisitionWebhook,
} from "./python-acquisition-webhook.js";

const secret = "webhook-test-secret-with-at-least-32-characters";
const payload = {
  event_id: "python_request_123456:completed:1",
  request_id: "python_request_123456",
  job_id: "11111111-1111-4111-8111-111111111111",
  task_id: "22222222-2222-4222-8222-222222222222",
  state: "completed",
  progress_current: null,
  progress_total: null,
};

describe("Python acquisition webhook", () => {
  it("verifies the exact raw body and parses an allowlisted event", () => {
    const body = Buffer.from(JSON.stringify(payload));
    const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
    expect(verifyPythonAcquisitionWebhook(body, signature, secret)).toEqual(payload);
  });

  it("rejects tampering and unknown states", () => {
    const body = Buffer.from(JSON.stringify(payload));
    const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
    expect(() =>
      verifyPythonAcquisitionWebhook(Buffer.concat([body, Buffer.from(" ")]), signature, secret),
    ).toThrow("invalid_signature");
    const invalidBody = Buffer.from(JSON.stringify({ ...payload, state: "shell" }));
    const invalidSignature = `sha256=${createHmac("sha256", secret).update(invalidBody).digest("hex")}`;
    expect(() => verifyPythonAcquisitionWebhook(invalidBody, invalidSignature, secret)).toThrow();
  });

  it("uses fixed product copy instead of callback-controlled messages", () => {
    expect(pythonAcquisitionEventCopy.failed).toEqual({
      severity: "warning",
      // The callback reports failure, not its cause or whether another tier exists.
      message:
        "This source download attempt did not complete. The worker is checking whether it can retry safely.",
    });
  });
});
