import { afterEach, describe, expect, it } from "vitest";
import { createWorkerHttpServer } from "./server.js";

const servers: ReturnType<typeof createWorkerHttpServer>[] = [];

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
});

async function start(ready = true) {
  const server = createWorkerHttpServer({
    getState: () => ({
      activeTask: false,
      cobaltEnabled: true,
      localRelayEnabled: true,
      potProviderConfigured: true,
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
      egress_ip: "203.0.113.7",
      error_code: null,
      proxy_reachable: true,
      proxy_tier: "warp",
      status: "healthy",
      warp_enabled: true,
      ytdlp_reachable: true,
      configured_members: 3,
      healthy_members: 2,
      unique_egress_members: 1,
      cobalt_enabled: true,
      local_relay_enabled: true,
    });
    expect(JSON.stringify(body)).not.toMatch(/secret|warp-a/);
  });
});
