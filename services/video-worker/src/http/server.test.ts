import { afterEach, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import type { PythonAcquisitionWebhook } from "./python-acquisition-webhook.js";
import { createWorkerHttpServer } from "./server.js";

const servers: ReturnType<typeof createWorkerHttpServer>[] = [];

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
});

async function start(
  ready = true,
  webhook?: {
    secret: string;
    handler: (event: PythonAcquisitionWebhook) => Promise<void>;
  },
) {
  const server = createWorkerHttpServer({
    getState: () => ({
      activeTask: false,
      acquisitionTiers: {
        cobalt: { configured: true, reasonCode: "cobalt_ready", state: "ready" },
        operatorProxy: {
          configured: false,
          reasonCode: "operator_proxy_unconfigured",
          state: "unconfigured",
        },
        protectedPool: {
          configured: true,
          configuredMembers: 3,
          healthyMembers: 2,
          uniqueMembers: 1,
          reasonCode: "protected_pool_ready",
          state: "ready",
        },
      },
      cobaltEnabled: true,
      potProviderConfigured: true,
      pythonAcquisitionReady: true,
      proxyHealth: {
        checkedAt: "2026-07-18T20:00:00.000Z",
        egressIp: "203.0.113.7",
        errorCode: null,
        proxyReachable: true,
        status: "healthy",
        tier: "warp",
        warpEnabled: true,
        ytdlpReachable: true,
        configuredMembers: 3,
        healthyMembers: 2,
        uniqueEgressMembers: 1,
        uniqueMembers: [],
      },
      ready,
    }),
    revision: "test-revision",
    onPythonAcquisitionWebhook: webhook?.handler,
    pythonWebhookSecret: webhook?.secret,
    wakeSecret: "a-secure-worker-wake-secret",
    workerId: "worker-test",
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind.");
  return `http://127.0.0.1:${address.port}`;
}

describe("worker HTTP server", () => {
  it("reports health and readiness without exposing configuration", async () => {
    const origin = await start();
    const health = await fetch(`${origin}/healthz`);
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({
      activeTask: false,
      potProviderConfigured: true,
      pythonAcquisitionReady: true,
      revision: "test-revision",
      status: "ok",
      workerId: "worker-test",
    });
    expect((await fetch(`${origin}/readyz`)).status).toBe(200);
  });

  it("requires the configured bearer secret to wake", async () => {
    const origin = await start();
    expect((await fetch(`${origin}/wake`, { method: "POST" })).status).toBe(401);
    expect(
      (
        await fetch(`${origin}/wake`, {
          headers: { authorization: "Bearer a-secure-worker-wake-secret" },
          method: "POST",
        })
      ).status,
    ).toBe(202);
  });

  it("protects detailed proxy health with the worker bearer secret", async () => {
    const origin = await start();
    expect((await fetch(`${origin}/health/proxy`)).status).toBe(401);
    const response = await fetch(`${origin}/health/proxy`, {
      headers: { authorization: "Bearer a-secure-worker-wake-secret" },
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      checked_at: "2026-07-18T20:00:00.000Z",
      error_code: null,
      proxy_reachable: true,
      proxy_tier: "warp",
      python_acquisition_ready: true,
      status: "healthy",
      warp_enabled: true,
      ytdlp_reachable: true,
      configured_members: 3,
      healthy_members: 2,
      unique_egress_members: 1,
      cobalt_enabled: true,
      tiers: {
        cobalt: { configured: true, reasonCode: "cobalt_ready", state: "ready" },
        operator_proxy: {
          configured: false,
          reasonCode: "operator_proxy_unconfigured",
          state: "unconfigured",
        },
        protected_pool: {
          configured: true,
          configuredMembers: 3,
          healthyMembers: 2,
          uniqueMembers: 1,
          reasonCode: "protected_pool_ready",
          state: "ready",
        },
      },
    });
    expect(JSON.stringify(body)).not.toMatch(/secret|warp-a|203\.0\.113/);
  });

  it("accepts only signed, bounded Python acquisition callbacks", async () => {
    const received: PythonAcquisitionWebhook[] = [];
    const secret = "python-webhook-test-secret-with-32-characters";
    const origin = await start(true, {
      secret,
      handler: async (event) => {
        received.push(event);
      },
    });
    const payload = {
      event_id: "python_request_123456:completed:1",
      request_id: "python_request_123456",
      job_id: "11111111-1111-4111-8111-111111111111",
      task_id: "22222222-2222-4222-8222-222222222222",
      state: "completed",
      progress_current: null,
      progress_total: null,
    };
    const body = JSON.stringify(payload);
    const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
    const accepted = await fetch(`${origin}/internal/python-acquisition/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-vidrial-signature": signature },
      body,
    });
    expect(accepted.status).toBe(202);
    expect(received).toEqual([payload]);
    expect(
      (
        await fetch(`${origin}/internal/python-acquisition/webhook`, {
          method: "POST",
          body,
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await fetch(`${origin}/internal/python-acquisition/webhook`, {
          method: "POST",
          body: "x".repeat(16_385),
        })
      ).status,
    ).toBe(413);
  });
});
