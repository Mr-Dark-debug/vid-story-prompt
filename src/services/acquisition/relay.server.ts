import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getServerEnv } from "@/config/env.server";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { getCurrentSession } from "@/services/auth/server";
import {
  hashRelaySecret,
  createRelayDeviceCredential,
  createRelayNonce,
  createRelayPairingChallenge,
  createRelayPairingCode,
  signRelayCapability,
  verifyRelayCapability,
  type RelayCapabilityClaims,
} from "./relay-token.server";

const helperVersion = z.string().trim().min(1).max(40);
const pairingPayload = z.object({
  pairingToken: z.string().min(20).max(300),
  displayName: z.string().trim().min(1).max(120),
  helperVersion,
});
const callbackPayload = z.object({
  requestId: z.string().uuid(),
  capability: z.string().min(40).max(4096),
  eventId: z.string().min(8).max(300),
});

type RelayRequestRow = Database["public"]["Tables"]["acquisition_relay_requests"]["Row"];
type RelayRpcName =
  | "record_source_acquisition_attempt"
  | "create_acquisition_relay_request"
  | "lease_acquisition_relay_request"
  | "heartbeat_acquisition_relay_request"
  | "complete_acquisition_relay_request"
  | "fail_acquisition_relay_request";
type RelayRpcClient = {
  rpc: (
    name: RelayRpcName,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

function admin() {
  return getSupabaseAdminClient();
}

function callRelayRpc(
  client: ReturnType<typeof getSupabaseAdminClient>,
  name: RelayRpcName,
  args: Record<string, unknown>,
) {
  return (client as unknown as RelayRpcClient).rpc(name, args);
}

function rpcRow<T>(data: unknown) {
  return (Array.isArray(data) ? data[0] : data) as T;
}

function relayConfig() {
  const env = getServerEnv();
  if (!env.LOCAL_RELAY_ENABLED || !env.LOCAL_RELAY_SIGNING_KEY) {
    throw new Error("The local acquisition helper is not enabled.");
  }
  return { key: env.LOCAL_RELAY_SIGNING_KEY };
}

function bearer(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) throw new Error("Device authentication required.");
  return header.slice(7);
}

async function deviceForRequest(request: Request) {
  const credential = bearer(request);
  const client = admin();
  const { data, error } = await client
    .from("acquisition_relay_devices")
    .select("*")
    .eq("credential_hash", hashRelaySecret(credential))
    .eq("status", "active")
    .maybeSingle();
  if (error || !data) throw new Error("Device authentication rejected.");
  return { client, credential, device: data };
}

function capabilityFromRequest(row: RelayRequestRow): RelayCapabilityClaims {
  const nonce = String(row.upload_path).match(/\/relay\/([0-9a-f-]{36})\.[a-z0-9]+$/i)?.[1];
  if (!nonce) throw new Error("Relay request is malformed.");
  return {
    version: 1,
    jobId: row.clip_job_id,
    videoId: row.youtube_video_id,
    expectedDurationSeconds: Number(row.expected_duration_seconds),
    sourceSection: z
      .object({ startSeconds: z.number().nonnegative(), endSeconds: z.number().positive() })
      .nullable()
      .parse(row.source_section ?? null),
    uploadPath: row.upload_path,
    maximumBytes: Number(row.maximum_bytes),
    expiresAt: row.expires_at,
    nonce,
  };
}

function assertCapability(row: RelayRequestRow, token: string) {
  const { key } = relayConfig();
  if (hashRelaySecret(token) !== row.capability_hash) throw new Error("Relay capability mismatch.");
  const claims = verifyRelayCapability(token, key);
  if (claims.jobId !== row.clip_job_id || claims.uploadPath !== row.upload_path) {
    throw new Error("Relay capability scope mismatch.");
  }
  return claims;
}

export const createRelayPairing = createServerFn({ method: "POST" })
  .validator(z.object({ displayName: z.string().trim().min(1).max(120).default("This device") }))
  .handler(async () => {
    relayConfig();
    const session = await getCurrentSession();
    if (!session?.workspaceId) throw new Error("Your workspace session expired.");
    const code = createRelayPairingCode();
    const challenge = createRelayPairingChallenge();
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
    const { error } = await admin()
      .from("acquisition_relay_pairings")
      .insert({
        workspace_id: session.workspaceId,
        user_id: session.id,
        challenge_hash: hashRelaySecret(challenge),
        display_code_hash: hashRelaySecret(code),
        expires_at: expiresAt,
      });
    if (error) throw new Error("A device pairing could not be created.");
    return { pairingToken: `${code}.${challenge}`, expiresAt };
  });

export const listRelayDevices = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getCurrentSession();
  if (!session?.workspaceId) return [];
  const client = getSupabaseServerClient();
  const { data, error } = await client
    .from("acquisition_relay_devices")
    .select("id,display_name,helper_version,status,last_seen_at,created_at")
    .eq("workspace_id", session.workspaceId)
    .eq("user_id", session.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Paired devices could not be loaded.");
  return data ?? [];
});

export const revokeRelayDevice = createServerFn({ method: "POST" })
  .validator(z.object({ deviceId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const session = await getCurrentSession();
    if (!session?.workspaceId) throw new Error("Your workspace session expired.");
    const { error } = await admin()
      .from("acquisition_relay_devices")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.deviceId)
      .eq("workspace_id", session.workspaceId)
      .eq("user_id", session.id);
    if (error) throw new Error("The paired device could not be revoked.");
    return { ok: true };
  });

export const startLocalRelay = createServerFn({ method: "POST" })
  .validator(z.object({ jobId: z.string().uuid(), deviceId: z.string().uuid().optional() }))
  .handler(async ({ data }) => {
    const { key } = relayConfig();
    const session = await getCurrentSession();
    if (!session?.workspaceId) throw new Error("Your workspace session expired.");
    const client = admin();
    const { data: job } = await getSupabaseServerClient()
      .from("clip_jobs")
      .select("id,workspace_id,user_id,status,youtube_video_id,source_duration_seconds")
      .eq("id", data.jobId)
      .maybeSingle();
    if (!job || job.workspace_id !== session.workspaceId || job.user_id !== session.id) {
      throw new Error("This clipping job is unavailable.");
    }
    if (job.status !== "awaiting_authorised_source" && job.status !== "awaiting_local_relay") {
      throw new Error("This job no longer needs local acquisition.");
    }
    const deviceQuery = client
      .from("acquisition_relay_devices")
      .select("id")
      .eq("workspace_id", session.workspaceId)
      .eq("user_id", session.id)
      .eq("status", "active");
    if (data.deviceId) deviceQuery.eq("id", data.deviceId);
    const { data: device } = await deviceQuery
      .order("last_seen_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!device) throw new Error("Pair a local helper before continuing on this device.");

    const { data: existing } = await client
      .from("acquisition_relay_requests")
      .select("*")
      .eq("clip_job_id", job.id)
      .in("status", ["pending", "leased", "downloading", "uploading"])
      .maybeSingle();
    if (existing) return { requestId: existing.id, status: existing.status };

    const { data: task } = await client
      .from("job_tasks")
      .select("id,input_json")
      .eq("clip_job_id", job.id)
      .eq("task_type", "download_youtube_source")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!task) throw new Error("The source acquisition task is missing.");
    const { count } = await client
      .from("source_acquisition_attempts")
      .select("id", { count: "exact", head: true })
      .eq("job_task_id", task.id);
    const ordinal = (count ?? 0) + 1;
    const { data: attempt, error: attemptError } = await callRelayRpc(
      client,
      "record_source_acquisition_attempt",
      {
        p_job_task_id: task.id,
        p_ordinal: ordinal,
        p_source_tier: "local_relay",
        p_strategy: "local_helper",
        p_pool_member_index: null,
        p_pool_member_id: "",
        p_egress_fingerprint: "",
        p_idempotency_key: `${task.id}:${ordinal}:local_relay:${device.id}`,
      },
    );
    if (attemptError) throw new Error("The local acquisition attempt could not be queued.");
    const attemptRow = rpcRow<{ id: string }>(attempt);
    const nonce = createRelayNonce();
    const expiresAt = new Date(Date.now() + 2 * 60 * 60_000).toISOString();
    const uploadPath = `${job.workspace_id}/${job.user_id}/${job.id}/relay/${nonce}.mp4`;
    const taskInput =
      task.input_json && typeof task.input_json === "object" && !Array.isArray(task.input_json)
        ? (task.input_json as Record<string, unknown>)
        : {};
    const sourceSection = z
      .object({ startSeconds: z.number().nonnegative(), endSeconds: z.number().positive() })
      .nullable()
      .catch(null)
      .parse(taskInput.sourceSection ?? null);
    const claims: RelayCapabilityClaims = {
      version: 1,
      jobId: job.id,
      videoId: job.youtube_video_id!,
      expectedDurationSeconds: Number(job.source_duration_seconds),
      sourceSection,
      uploadPath,
      maximumBytes: 2_147_483_648,
      expiresAt,
      nonce,
    };
    const capability = signRelayCapability(claims, key);
    const { data: request, error } = await callRelayRpc(
      client,
      "create_acquisition_relay_request",
      {
        p_job_task_id: task.id,
        p_acquisition_attempt_id: attemptRow.id,
        p_capability_hash: hashRelaySecret(capability),
        p_nonce_hash: hashRelaySecret(nonce),
        p_upload_path: uploadPath,
        p_maximum_bytes: claims.maximumBytes,
        p_source_section: sourceSection,
        p_requested_device_id: device.id,
        p_expires_at: expiresAt,
      },
    );
    if (error) throw new Error("The local acquisition request could not be queued.");
    const row = rpcRow<RelayRequestRow>(request);
    return { requestId: row.id, status: row.status };
  });

export async function pairRelayDevice(input: unknown) {
  relayConfig();
  const data = pairingPayload.parse(input);
  const [code, challenge, extra] = data.pairingToken.split(".");
  if (!code || !challenge || extra) throw new Error("Pairing token is invalid.");
  const client = admin();
  const { data: pairing } = await client
    .from("acquisition_relay_pairings")
    .select("*")
    .eq("display_code_hash", hashRelaySecret(code.toUpperCase()))
    .eq("challenge_hash", hashRelaySecret(challenge))
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!pairing) throw new Error("Pairing token expired or was already used.");
  const { data: claimed } = await client
    .from("acquisition_relay_pairings")
    .update({ status: "cancelled" })
    .eq("id", pairing.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (!claimed) throw new Error("Pairing token expired or was already used.");
  const credential = createRelayDeviceCredential();
  const { data: device, error } = await client
    .from("acquisition_relay_devices")
    .insert({
      workspace_id: pairing.workspace_id,
      user_id: pairing.user_id,
      display_name: data.displayName,
      helper_version: data.helperVersion,
      credential_hash: hashRelaySecret(credential),
    })
    .select("id")
    .single();
  if (error) throw new Error("Device pairing failed.");
  await client
    .from("acquisition_relay_pairings")
    .update({
      status: "completed",
      completed_device_id: device.id,
      completed_at: new Date().toISOString(),
    })
    .eq("id", pairing.id)
    .eq("status", "cancelled");
  return { deviceId: device.id, deviceToken: credential };
}

export async function leaseRelayRequest(request: Request) {
  const { client, device } = await deviceForRequest(request);
  const { data: pending } = await client
    .from("acquisition_relay_requests")
    .select("*")
    .or(`requested_device_id.eq.${device.id},requested_device_id.is.null`)
    .in("status", ["pending", "leased", "downloading", "uploading"])
    .gt("expires_at", new Date().toISOString())
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!pending) return null;
  const { data, error } = await callRelayRpc(client, "lease_acquisition_relay_request", {
    p_request_id: pending.id,
    p_device_id: device.id,
    p_lease_seconds: 120,
  });
  if (error) throw new Error("Relay request could not be leased.");
  const row = rpcRow<RelayRequestRow>(data);
  const capability = signRelayCapability(capabilityFromRequest(row), relayConfig().key);
  if (hashRelaySecret(capability) !== row.capability_hash)
    throw new Error("Relay capability could not be restored.");
  const { data: upload, error: uploadError } = await client.storage
    .from(row.upload_bucket)
    .createSignedUploadUrl(row.upload_path);
  if (uploadError) throw new Error("A relay upload URL could not be created.");
  return {
    requestId: row.id,
    capability,
    videoId: row.youtube_video_id,
    expectedDurationSeconds: Number(row.expected_duration_seconds),
    sourceSection: row.source_section,
    maximumBytes: Number(row.maximum_bytes),
    expiresAt: row.expires_at,
    uploadUrl: upload.signedUrl,
  };
}

export async function heartbeatRelayRequest(request: Request, input: unknown) {
  const data = callbackPayload
    .extend({
      status: z.enum(["downloading", "uploading"]),
      current: z.number().int().nonnegative().nullable().optional(),
      total: z.number().int().nonnegative().nullable().optional(),
    })
    .parse(input);
  const { client, device } = await deviceForRequest(request);
  const { data: row } = await client
    .from("acquisition_relay_requests")
    .select("*")
    .eq("id", data.requestId)
    .single();
  if (!row) throw new Error("Relay request not found.");
  assertCapability(row, data.capability);
  const { error } = await callRelayRpc(client, "heartbeat_acquisition_relay_request", {
    p_request_id: data.requestId,
    p_device_id: device.id,
    p_status: data.status,
    p_progress_current: data.current ?? null,
    p_progress_total: data.total ?? null,
    p_lease_seconds: 120,
  });
  if (error) throw new Error("Relay heartbeat was rejected.");
  return { ok: true };
}

export async function completeRelayRequest(request: Request, input: unknown) {
  const data = callbackPayload
    .extend({
      bytes: z.number().int().positive(),
      checksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .parse(input);
  const { client, device } = await deviceForRequest(request);
  const { data: row } = await client
    .from("acquisition_relay_requests")
    .select("*")
    .eq("id", data.requestId)
    .single();
  if (!row) throw new Error("Relay request not found.");
  const claims = assertCapability(row, data.capability);
  if (data.bytes > claims.maximumBytes) throw new Error("Relay upload exceeded its size limit.");
  const pathParts = claims.uploadPath.split("/");
  const filename = pathParts.pop()!;
  const { data: objects, error: objectError } = await client.storage
    .from(row.upload_bucket)
    .list(pathParts.join("/"), { search: filename, limit: 1 });
  const object = objects?.find((item) => item.name === filename);
  if (objectError || !object || Number(object.metadata?.size ?? -1) !== data.bytes) {
    throw new Error("Relay upload could not be verified.");
  }
  const { data: job } = await client
    .from("clip_jobs")
    .select("source_type,source_title")
    .eq("id", row.clip_job_id)
    .single();
  if (!job) throw new Error("Relay clipping job not found.");
  const { error: assetError } = await client.from("media_assets").upsert(
    {
      id: row.id,
      workspace_id: row.workspace_id,
      user_id: row.user_id,
      source_type: job.source_type,
      storage_bucket: row.upload_bucket,
      storage_path: row.upload_path,
      display_name: job.source_title ?? "Local relay source",
      mime_type: "video/mp4",
      size_bytes: data.bytes,
      checksum_sha256: data.checksumSha256,
      status: "ready",
      metadata_json: { connectorId: "local_relay", relayRequestId: row.id },
    },
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (assetError) throw new Error("Relay media record could not be created.");
  const { data: result, error } = await callRelayRpc(client, "complete_acquisition_relay_request", {
    p_request_id: data.requestId,
    p_device_id: device.id,
    p_media_asset_id: row.id,
    p_checksum_sha256: data.checksumSha256,
    p_provider_event_id: data.eventId,
  });
  if (error) throw new Error("Relay completion was rejected.");
  return { ok: true, status: rpcRow<RelayRequestRow>(result).status };
}

export async function failRelayRequest(request: Request, input: unknown) {
  const data = callbackPayload
    .extend({
      errorCode: z.string().min(1).max(120),
      errorMessage: z.string().min(1).max(1000),
    })
    .parse(input);
  const { client, device } = await deviceForRequest(request);
  const { data: row } = await client
    .from("acquisition_relay_requests")
    .select("*")
    .eq("id", data.requestId)
    .single();
  if (!row) throw new Error("Relay request not found.");
  assertCapability(row, data.capability);
  const { error } = await callRelayRpc(client, "fail_acquisition_relay_request", {
    p_request_id: data.requestId,
    p_device_id: device.id,
    p_error_code: data.errorCode,
    p_error_message: data.errorMessage,
    p_provider_event_id: data.eventId,
  });
  if (error) throw new Error("Relay failure callback was rejected.");
  return { ok: true };
}
