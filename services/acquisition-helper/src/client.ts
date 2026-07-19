import { createReadStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { RelayConfig } from "./config.js";
import { acquireLocalSource, sha256File, type SourceSection } from "./youtube.js";

const version = "0.1.0";

function endpoint(serverUrl: string, action: string) {
  return new URL(`/api/acquisition/relay/${action}`, serverUrl).toString();
}

async function jsonRequest(url: string, init: RequestInit) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) throw new Error("The Vidrial relay server rejected the request.");
  return body;
}

function auth(config: RelayConfig) {
  return { authorization: `Bearer ${config.deviceToken}`, "content-type": "application/json" };
}

export async function pairDevice(input: {
  serverUrl: string;
  pairingToken: string;
  displayName: string;
}) {
  const result = await jsonRequest(endpoint(input.serverUrl, "pair"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      pairingToken: input.pairingToken,
      displayName: input.displayName,
      helperVersion: version,
    }),
  });
  if (typeof result.deviceId !== "string" || typeof result.deviceToken !== "string") {
    throw new Error("The pairing response was invalid.");
  }
  return {
    serverUrl: new URL(input.serverUrl).origin,
    deviceId: result.deviceId,
    deviceToken: result.deviceToken,
  };
}

async function callback(config: RelayConfig, action: string, payload: Record<string, unknown>) {
  return jsonRequest(endpoint(config.serverUrl, action), {
    method: "POST",
    headers: auth(config),
    body: JSON.stringify(payload),
  });
}

async function processLease(
  config: RelayConfig,
  lease: Record<string, unknown>,
  cookiesPath?: string,
) {
  const requestId = String(lease.requestId);
  const capability = String(lease.capability);
  const base = { requestId, capability };
  const directory = await mkdtemp(join(tmpdir(), "vidrial-relay-"));
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let phase: "downloading" | "uploading" = "downloading";
  try {
    heartbeat = setInterval(() => {
      void callback(config, "heartbeat", {
        ...base,
        eventId: randomUUID(),
        status: phase,
      }).catch(() => undefined);
    }, 45_000);
    const source = await acquireLocalSource({
      videoId: String(lease.videoId),
      directory,
      maximumBytes: Number(lease.maximumBytes),
      expectedDurationSeconds: Number(lease.expectedDurationSeconds),
      section: (lease.sourceSection as SourceSection | null) ?? null,
      cookiesPath,
      signal: AbortSignal.timeout(30 * 60_000),
    });
    phase = "uploading";
    await callback(config, "heartbeat", {
      ...base,
      eventId: randomUUID(),
      status: "uploading",
      current: 0,
      total: source.bytes,
    });
    const uploadInit = {
      method: "PUT",
      headers: { "content-type": "video/mp4", "x-upsert": "false" },
      body: createReadStream(source.filename),
      duplex: "half",
      signal: AbortSignal.timeout(30 * 60_000),
    } as unknown as RequestInit;
    const upload = await fetch(String(lease.uploadUrl), uploadInit);
    if (!upload.ok) throw new Error("The signed source upload failed.");
    const checksumSha256 = await sha256File(source.filename);
    await callback(config, "complete", {
      ...base,
      eventId: randomUUID(),
      bytes: source.bytes,
      checksumSha256,
    });
    process.stdout.write(`relay=completed request=${requestId}\n`);
  } catch (error) {
    await callback(config, "fail", {
      ...base,
      eventId: randomUUID(),
      errorCode: "local_acquisition_failed",
      errorMessage:
        error instanceof Error ? error.message.slice(0, 500) : "Local acquisition failed.",
    }).catch(() => undefined);
    throw error;
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    await rm(directory, { recursive: true, force: true });
  }
}

export async function runRelay(config: RelayConfig, cookiesPath?: string) {
  process.stdout.write("relay=online waiting_for_jobs=true\n");
  for (;;) {
    const lease = await jsonRequest(endpoint(config.serverUrl, "lease"), {
      method: "POST",
      headers: auth(config),
      body: "{}",
    });
    if (lease && typeof lease.requestId === "string") {
      await processLease(config, lease, cookiesPath).catch((error) => {
        process.stderr.write(`${error instanceof Error ? error.message : "Relay job failed."}\n`);
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
}
