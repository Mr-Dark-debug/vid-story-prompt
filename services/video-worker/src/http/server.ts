import { timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import type { ProxyHealthSnapshot } from "../health/proxy-health.js";

type WorkerState = {
  activeTask: boolean;
  potProviderConfigured: boolean;
  proxyHealth: ProxyHealthSnapshot;
  ready: boolean;
};

type WorkerServerOptions = {
  getState: () => WorkerState;
  revision: string;
  wakeSecret?: string;
  workerId: string;
};

function bearerMatches(header: string | undefined, secret: string) {
  if (!header) return false;
  const actual = Buffer.from(header);
  const expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function json(response: import("node:http").ServerResponse, status: number, body: object) {
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
}

export function createWorkerHttpServer(options: WorkerServerOptions) {
  return createServer((request, response) => {
    const path = new URL(request.url ?? "/", "http://worker.local").pathname;
    const state = options.getState();

    if (request.method === "GET" && path === "/healthz") {
      json(response, 200, {
        activeTask: state.activeTask,
        potProviderConfigured: state.potProviderConfigured,
        revision: options.revision,
        status: "ok",
        workerId: options.workerId,
      });
      return;
    }

    if (request.method === "GET" && path === "/readyz") {
      json(response, state.ready ? 200 : 503, {
        status: state.ready ? "ready" : "not_ready",
      });
      return;
    }

    if (request.method === "GET" && path === "/health/proxy") {
      if (!options.wakeSecret) {
        json(response, 503, { error: "proxy_health_not_configured" });
        return;
      }
      if (!bearerMatches(request.headers.authorization, options.wakeSecret)) {
        json(response, 401, { error: "unauthorized" });
        return;
      }
      json(response, 200, {
        checked_at: state.proxyHealth.checkedAt,
        egress_ip: state.proxyHealth.egressIp,
        error_code: state.proxyHealth.errorCode,
        proxy_reachable: state.proxyHealth.proxyReachable,
        proxy_tier: state.proxyHealth.tier,
        status: state.proxyHealth.status,
        warp_enabled: state.proxyHealth.warpEnabled,
        ytdlp_reachable: state.proxyHealth.ytdlpReachable,
      });
      return;
    }

    if (request.method === "POST" && path === "/wake") {
      if (!options.wakeSecret) {
        json(response, 503, { error: "wake_not_configured" });
        return;
      }
      if (!bearerMatches(request.headers.authorization, options.wakeSecret)) {
        json(response, 401, { error: "unauthorized" });
        return;
      }
      json(response, 202, { activeTask: state.activeTask, status: "accepted" });
      return;
    }

    json(response, 404, { error: "not_found" });
  });
}
