import { randomUUID } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getCurrentSession } from "@/services/auth/server";
import { wakeVideoWorker } from "@/services/worker/server";
import { decryptSecret, encryptSecret } from "@/services/youtube/token-crypto.server";
import { listGoogleDriveAssets } from "./google-drive/adapter.server";
import { listDropboxAssets } from "./dropbox/adapter.server";
import { listOneDriveAssets } from "./onedrive/adapter.server";
import {
  connectorEncryptionKey,
  getConnectorOAuthConfig,
  type OAuthConnectorId,
} from "./oauth.server";

const connectorSchema = z.enum(["google_drive", "dropbox", "onedrive"]);

type Query = PromiseLike<{
  data: Record<string, unknown> | null;
  error: { message: string } | null;
}> & {
  select(columns?: string): Query;
  update(value: Record<string, unknown>): Query;
  insert(value: Record<string, unknown>): Query;
  upsert(value: Record<string, unknown>, options?: Record<string, unknown>): Query;
  eq(column: string, value: unknown): Query;
  in(column: string, values: unknown[]): Query;
  single(): Query;
  maybeSingle(): Query;
};
type Db = { from(table: string): Query };

async function connectionForUser(connectorId: OAuthConnectorId) {
  const session = await getCurrentSession();
  if (!session?.workspaceId) throw new Error("Your session expired.");
  const admin = getSupabaseAdminClient() as unknown as Db;
  const { data, error } = await admin
    .from("oauth_connections")
    .select(
      "id,connector_id,access_token_encrypted,refresh_token_encrypted,token_expires_at,status,scopes",
    )
    .eq("workspace_id", session.workspaceId)
    .eq("user_id", session.id)
    .eq("connector_id", connectorId)
    .maybeSingle();
  if (error || !data || data.status !== "connected")
    throw new Error(`Connect ${connectorId.replaceAll("_", " ")} before browsing files.`);
  return { admin, connection: data };
}

async function accessToken(connectorId: OAuthConnectorId) {
  const { admin, connection } = await connectionForUser(connectorId);
  const encrypted = connection.access_token_encrypted;
  if (typeof encrypted !== "string")
    throw new Error("The connector access token is unavailable. Reconnect the account.");
  const expiresAt =
    typeof connection.token_expires_at === "string"
      ? Date.parse(connection.token_expires_at)
      : Number.POSITIVE_INFINITY;
  if (expiresAt > Date.now() + 60_000) return decryptSecret(encrypted, connectorEncryptionKey());
  if (typeof connection.refresh_token_encrypted !== "string")
    throw new Error("The connector session expired and cannot refresh. Reconnect the account.");
  const config = getConnectorOAuthConfig(connectorId);
  const refreshToken = decryptSecret(connection.refresh_token_encrypted, connectorEncryptionKey());
  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    await admin
      .from("oauth_connections")
      .update({
        status: "reconnect_required",
        error_code: "token_refresh_failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection.id);
    throw new Error("The connector session could not refresh. Reconnect the account.");
  }
  const refreshed = z
    .object({
      access_token: z.string(),
      refresh_token: z.string().optional(),
      expires_in: z.number().int().positive().optional(),
    })
    .parse(await response.json());
  await admin
    .from("oauth_connections")
    .update({
      access_token_encrypted: encryptSecret(refreshed.access_token, connectorEncryptionKey()),
      refresh_token_encrypted: refreshed.refresh_token
        ? encryptSecret(refreshed.refresh_token, connectorEncryptionKey())
        : connection.refresh_token_encrypted,
      token_expires_at: refreshed.expires_in
        ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
        : null,
      last_refreshed_at: new Date().toISOString(),
      error_code: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connection.id);
  return refreshed.access_token;
}

export const browseConnectorAssets = createServerFn({ method: "POST" })
  .validator(
    z.object({
      connectorId: connectorSchema,
      cursor: z.string().max(4096).optional(),
      query: z.string().max(200).optional(),
      sharedWithMe: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const token = await accessToken(data.connectorId);
    if (data.connectorId === "google_drive")
      return listGoogleDriveAssets({
        accessToken: token,
        cursor: data.cursor,
        query: data.query,
        sharedWithMe: data.sharedWithMe,
      });
    if (data.connectorId === "dropbox")
      return listDropboxAssets({ accessToken: token, cursor: data.cursor, query: data.query });
    return listOneDriveAssets({ accessToken: token, cursor: data.cursor, query: data.query });
  });

export const testConnectorConnection = createServerFn({ method: "POST" })
  .validator(z.object({ connectorId: connectorSchema }))
  .handler(async ({ data }) => {
    await accessToken(data.connectorId);
    const { admin, connection } = await connectionForUser(data.connectorId);
    const checkedAt = new Date().toISOString();
    await admin
      .from("oauth_connections")
      .update({ last_health_check_at: checkedAt, error_code: null, updated_at: checkedAt })
      .eq("id", connection.id);
    return { healthy: true, checkedAt };
  });

export const disconnectConnector = createServerFn({ method: "POST" })
  .validator(z.object({ connectorId: connectorSchema }))
  .handler(async ({ data }) => {
    const { admin, connection } = await connectionForUser(data.connectorId);
    const encrypted =
      typeof connection.refresh_token_encrypted === "string"
        ? connection.refresh_token_encrypted
        : connection.access_token_encrypted;
    if (typeof encrypted === "string") {
      const token = decryptSecret(encrypted, connectorEncryptionKey());
      try {
        if (data.connectorId === "google_drive")
          await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            signal: AbortSignal.timeout(8_000),
          });
        if (data.connectorId === "dropbox")
          await fetch("https://api.dropboxapi.com/2/auth/token/revoke", {
            method: "POST",
            headers: { authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(8_000),
          });
      } catch {
        // Local revocation still prevents future use during provider outages.
      }
    }
    const revokedAt = new Date().toISOString();
    await admin
      .from("oauth_connections")
      .update({
        access_token_encrypted: null,
        refresh_token_encrypted: null,
        status: "revoked",
        revoked_at: revokedAt,
        disconnected_at: revokedAt,
        updated_at: revokedAt,
      })
      .eq("id", connection.id);
    return { ok: true };
  });

const remoteAssetSchema = z.object({
  id: z.string().min(1).max(1024),
  name: z.string().min(1).max(500),
  kind: z.enum(["video", "audio"]),
  mimeType: z.string().max(200).nullable(),
  sizeBytes: z.number().int().nonnegative().nullable(),
  durationSeconds: z.number().int().positive().nullable(),
});

export const createConnectorImport = createServerFn({ method: "POST" })
  .validator(
    z.object({
      connectorId: connectorSchema,
      asset: remoteAssetSchema,
      idempotencyKey: z.string().uuid(),
    }),
  )
  .handler(async ({ data }) => {
    const session = await getCurrentSession();
    if (!session?.workspaceId) throw new Error("Your session expired.");
    const { admin, connection } = await connectionForUser(data.connectorId);
    const importId = randomUUID();
    const { data: imported, error } = await admin
      .from("connector_imports")
      .upsert(
        {
          id: importId,
          workspace_id: session.workspaceId,
          user_id: session.id,
          connector_connection_id: connection.id,
          connector_id: data.connectorId,
          remote_asset_id: data.asset.id,
          source_metadata_json: data.asset,
          status: "queued",
          bytes_total: data.asset.sizeBytes,
          idempotency_key: data.idempotencyKey,
        },
        { onConflict: "workspace_id,idempotency_key", ignoreDuplicates: true },
      )
      .select("id,status,destination_asset_id")
      .single();
    if (error || !imported || typeof imported.id !== "string")
      throw new Error(
        `The remote import could not be queued: ${error?.message ?? "unknown error"}`,
      );
    if (imported.status !== "ready") {
      const { error: taskError } = await admin.from("connector_tasks").upsert(
        {
          connector_import_id: imported.id,
          task_type: "stream_remote_asset",
          status: "queued",
          priority: 10,
          idempotency_key: `${imported.id}:stream`,
          next_attempt_at: new Date().toISOString(),
        },
        { onConflict: "idempotency_key", ignoreDuplicates: true },
      );
      if (taskError)
        throw new Error(`The remote import task could not be queued: ${taskError.message}`);
    }
    const workerWake = await wakeVideoWorker();
    return {
      importId: imported.id,
      status: String(imported.status),
      assetId:
        typeof imported.destination_asset_id === "string" ? imported.destination_asset_id : null,
      workerWake,
    };
  });

export const getConnectorImportProgress = createServerFn({ method: "GET" })
  .validator(z.object({ importId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const session = await getCurrentSession();
    if (!session?.workspaceId) throw new Error("Your session expired.");
    const admin = getSupabaseAdminClient() as unknown as Db;
    const { data: imported, error } = await admin
      .from("connector_imports")
      .select(
        "id,status,bytes_total,bytes_transferred,destination_asset_id,error_code,error_message,source_metadata_json",
      )
      .eq("id", data.importId)
      .eq("workspace_id", session.workspaceId)
      .eq("user_id", session.id)
      .single();
    if (error || !imported) throw new Error("The connector import is unavailable.");
    const metadata = remoteAssetSchema.partial().safeParse(imported.source_metadata_json);
    return {
      importId: String(imported.id),
      status: String(imported.status),
      bytesTotal: typeof imported.bytes_total === "number" ? imported.bytes_total : null,
      bytesTransferred:
        typeof imported.bytes_transferred === "number" ? imported.bytes_transferred : 0,
      assetId:
        typeof imported.destination_asset_id === "string" ? imported.destination_asset_id : null,
      durationSeconds:
        metadata.success && typeof metadata.data.durationSeconds === "number"
          ? metadata.data.durationSeconds
          : null,
      filename:
        metadata.success && typeof metadata.data.name === "string"
          ? metadata.data.name
          : "Imported source",
      errorCode: typeof imported.error_code === "string" ? imported.error_code : null,
      errorMessage: typeof imported.error_message === "string" ? imported.error_message : null,
    };
  });

export const cancelConnectorImport = createServerFn({ method: "POST" })
  .validator(z.object({ importId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const session = await getCurrentSession();
    if (!session?.workspaceId) throw new Error("Your session expired.");
    const admin = getSupabaseAdminClient() as unknown as Db;
    const cancelledAt = new Date().toISOString();
    const { error } = await admin
      .from("connector_imports")
      .update({ status: "cancelled", cancelled_at: cancelledAt, updated_at: cancelledAt })
      .eq("id", data.importId)
      .eq("workspace_id", session.workspaceId)
      .eq("user_id", session.id)
      .in("status", ["queued", "connecting", "transferring", "verifying", "retry_wait"]);
    if (error) throw new Error(error.message);
    await admin
      .from("connector_tasks")
      .update({ status: "cancelled", completed_at: cancelledAt })
      .eq("connector_import_id", data.importId)
      .in("status", ["queued", "leased", "retry_wait"]);
    return { ok: true };
  });
