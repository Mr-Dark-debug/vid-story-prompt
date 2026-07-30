import { timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import type { ProxyHealthSnapshot } from "../health/proxy-health.js";
import {
  verifyPythonAcquisitionWebhook,
  type PythonAcquisitionWebhook,
} from "./python-acquisition-webhook.js";

type WorkerState = {
  activeTask: boolean;
  cobaltEnabled: boolean;
  potProviderConfigured: boolean;
  pythonAcquisitionReady: boolean;
  proxyHealth: ProxyHealthSnapshot;
  ready: boolean;
};

type WorkerServerOptions = {
  getState: () => WorkerState;
  revision: string;
  onPythonAcquisitionWebhook?: (event: PythonAcquisitionWebhook) => Promise<void>;
  pythonWebhookSecret?: string;
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
  return createServer(async (request, response) => {
    const path = new URL(request.url ?? "/", "http://worker.local").pathname;
    const state = options.getState();

    if (request.method === "GET" && path === "/healthz") {
      json(response, 200, {
        activeTask: state.activeTask,
        potProviderConfigured: state.potProviderConfigured,
        pythonAcquisitionReady: state.pythonAcquisitionReady,
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
        configured_members: state.proxyHealth.configuredMembers ?? 1,
        healthy_members:
          state.proxyHealth.healthyMembers ?? (state.proxyHealth.proxyReachable ? 1 : 0),
        unique_egress_members:
          state.proxyHealth.uniqueEgressMembers ?? (state.proxyHealth.proxyReachable ? 1 : 0),
        cobalt_enabled: state.cobaltEnabled,
        python_acquisition_ready: state.pythonAcquisitionReady,
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

    if (request.method === "POST" && path === "/internal/python-acquisition/webhook") {
      if (!options.pythonWebhookSecret || !options.onPythonAcquisitionWebhook) {
        json(response, 503, { error: "python_webhook_not_configured" });
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      let event: PythonAcquisitionWebhook;
      try {
        for await (const chunk of request) {
          const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          size += value.length;
          if (size > 16_384) throw new Error("body_too_large");
          chunks.push(value);
        }
        const signature = Array.isArray(request.headers["x-vidrial-signature"])
          ? request.headers["x-vidrial-signature"][0]
          : request.headers["x-vidrial-signature"];
        event = verifyPythonAcquisitionWebhook(
          Buffer.concat(chunks),
          signature,
          options.pythonWebhookSecret,
        );
      } catch (error) {
        json(response, error instanceof Error && error.message === "body_too_large" ? 413 : 401, {
          error: "invalid_python_webhook",
        });
        return;
      }
      try {
        await options.onPythonAcquisitionWebhook(event);
        json(response, 202, { status: "accepted" });
      } catch {
        json(response, 503, { error: "python_webhook_persistence_failed" });
      }
      return;
    }

    json(response, 404, { error: "not_found" });
  });
}
