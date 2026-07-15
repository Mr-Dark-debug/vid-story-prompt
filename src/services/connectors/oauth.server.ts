import { createHash, createHmac, randomBytes } from "node:crypto";
import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { z } from "zod";
import { getServerEnv } from "@/config/env.server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getCurrentSession } from "@/services/auth/server";
import {
  decryptSecret,
  encryptSecret,
  safeReturnPath,
  secureTextEqual,
} from "@/services/youtube/token-crypto.server";

const oauthConnectorSchema = z.enum(["google_drive", "dropbox", "onedrive"]);
export type OAuthConnectorId = z.infer<typeof oauthConnectorSchema>;
const randomToken = createServerOnlyFn((bytes: number) => randomBytes(bytes).toString("base64url"));
const sha256Base64Url = createServerOnlyFn((value: string) =>
  createHash("sha256").update(value).digest("base64url"),
);
const sha256Hex = createServerOnlyFn((value: string) =>
  createHash("sha256").update(value).digest("hex"),
);

type ProviderConfig = {
  connectorId: OAuthConnectorId;
  provider: string;
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
  extraAuthorization?: Record<string, string>;
};

type GenericQuery = PromiseLike<{
  data: Record<string, unknown> | null;
  error: { message: string } | null;
}> & {
  select(columns?: string): GenericQuery;
  insert(value: Record<string, unknown>): GenericQuery;
  update(value: Record<string, unknown>): GenericQuery;
  upsert(value: Record<string, unknown>, options?: Record<string, unknown>): GenericQuery;
  eq(column: string, value: unknown): GenericQuery;
  is(column: string, value: null): GenericQuery;
  gt(column: string, value: unknown): GenericQuery;
  single(): GenericQuery;
  maybeSingle(): GenericQuery;
};
type GenericDb = { from(table: string): GenericQuery };

export function connectorEncryptionKey() {
  const env = getServerEnv();
  const key = env.CONNECTOR_TOKEN_ENCRYPTION_KEY ?? env.GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY;
  if (!key) throw new Error("Connector OAuth requires CONNECTOR_TOKEN_ENCRYPTION_KEY.");
  return key;
}

export function getConnectorOAuthConfig(id: OAuthConnectorId): ProviderConfig {
  const env = getServerEnv();
  if (id === "google_drive") {
    const clientId = env.GOOGLE_DRIVE_CLIENT_ID ?? env.GOOGLE_CLIENT_ID;
    const clientSecret = env.GOOGLE_DRIVE_CLIENT_SECRET ?? env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error("Google Drive OAuth is not configured.");
    return {
      connectorId: id,
      provider: "google_drive",
      clientId,
      clientSecret,
      authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      scopes: ["openid", "email", "profile", "https://www.googleapis.com/auth/drive.readonly"],
      extraAuthorization: {
        access_type: "offline",
        include_granted_scopes: "true",
        prompt: "consent",
      },
    };
  }
  if (id === "dropbox") {
    if (!env.DROPBOX_APP_KEY || !env.DROPBOX_APP_SECRET)
      throw new Error("Dropbox OAuth is not configured.");
    return {
      connectorId: id,
      provider: "dropbox",
      clientId: env.DROPBOX_APP_KEY,
      clientSecret: env.DROPBOX_APP_SECRET,
      authorizationUrl: "https://www.dropbox.com/oauth2/authorize",
      tokenUrl: "https://api.dropboxapi.com/oauth2/token",
      scopes: ["account_info.read", "files.metadata.read", "files.content.read"],
      extraAuthorization: { token_access_type: "offline" },
    };
  }
  if (!env.MICROSOFT_CLIENT_ID || !env.MICROSOFT_CLIENT_SECRET)
    throw new Error("OneDrive OAuth is not configured.");
  const tenant = encodeURIComponent(env.MICROSOFT_TENANT_ID);
  return {
    connectorId: id,
    provider: "microsoft_onedrive",
    clientId: env.MICROSOFT_CLIENT_ID,
    clientSecret: env.MICROSOFT_CLIENT_SECRET,
    authorizationUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
    tokenUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    scopes: ["openid", "profile", "offline_access", "User.Read", "Files.Read.All"],
  };
}

function callbackUrl(id: OAuthConnectorId) {
  return new URL(`/auth/connectors/${id}/callback`, getServerEnv().PUBLIC_APP_URL).toString();
}

export const createSignedOAuthState = createServerOnlyFn((nonce: string) => {
  return `${nonce}.${createHmac("sha256", connectorEncryptionKey()).update(nonce).digest("base64url")}`;
});

export const verifyConnectorOAuthState = createServerOnlyFn((state: string) => {
  const [nonce, signature, extra] = state.split(".");
  if (!nonce || !signature || extra) return false;
  return secureTextEqual(
    signature,
    createHmac("sha256", connectorEncryptionKey()).update(nonce).digest("base64url"),
  );
});

export function connectorConfigured(id: OAuthConnectorId) {
  try {
    getConnectorOAuthConfig(id);
    connectorEncryptionKey();
    return true;
  } catch {
    return false;
  }
}

export const beginConnectorConnection = createServerFn({ method: "POST" })
  .validator(
    z.object({ connectorId: oauthConnectorSchema, returnTo: z.string().max(1024).optional() }),
  )
  .handler(async ({ data }) => {
    const session = await getCurrentSession();
    if (!session?.workspaceId) throw new Error("Log in before connecting a source.");
    const config = getConnectorOAuthConfig(data.connectorId);
    const verifier = randomToken(48);
    const challenge = sha256Base64Url(verifier);
    const state = createSignedOAuthState(randomToken(32));
    const stateHash = sha256Hex(state);
    const admin = getSupabaseAdminClient() as unknown as GenericDb;
    const { error } = await admin.from("oauth_states").insert({
      workspace_id: session.workspaceId,
      user_id: session.id,
      connector_id: data.connectorId,
      state_hash: stateHash,
      code_verifier_encrypted: encryptSecret(verifier, connectorEncryptionKey()),
      return_url: safeReturnPath(data.returnTo),
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    });
    if (error) throw new Error(`OAuth state could not be created: ${error.message}`);
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: callbackUrl(data.connectorId),
      response_type: "code",
      scope: config.scopes.join(" "),
      code_challenge: challenge,
      code_challenge_method: "S256",
      state,
      ...config.extraAuthorization,
    });
    return { url: `${config.authorizationUrl}?${params}`, connectorId: data.connectorId };
  });

const tokenSchema = z.object({
  access_token: z.string().min(8),
  refresh_token: z.string().min(8).optional(),
  expires_in: z.number().int().positive().optional(),
  scope: z.string().optional(),
  token_type: z.string().optional(),
});

async function providerIdentity(id: OAuthConnectorId, accessToken: string) {
  if (id === "google_drive") {
    const response = await fetch(
      "https://www.googleapis.com/drive/v3/about?fields=user(permissionId,displayName,emailAddress)",
      { headers: { authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10_000) },
    );
    if (!response.ok) throw new Error("Google Drive could not verify the connected account.");
    const data = z
      .object({
        user: z.object({
          permissionId: z.string(),
          displayName: z.string().optional(),
          emailAddress: z.string().optional(),
        }),
      })
      .parse(await response.json());
    return {
      id: data.user.permissionId,
      displayName: data.user.displayName ?? data.user.emailAddress ?? "Google Drive account",
      metadata: { email: data.user.emailAddress },
    };
  }
  if (id === "dropbox") {
    const response = await fetch("https://api.dropboxapi.com/2/users/get_current_account", {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("Dropbox could not verify the connected account.");
    const data = z
      .object({
        account_id: z.string(),
        name: z.object({ display_name: z.string() }),
        email: z.string().optional(),
      })
      .parse(await response.json());
    return {
      id: data.account_id,
      displayName: data.name.display_name,
      metadata: { email: data.email },
    };
  }
  const response = await fetch(
    "https://graph.microsoft.com/v1.0/me?$select=id,displayName,userPrincipalName",
    { headers: { authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10_000) },
  );
  if (!response.ok) throw new Error("Microsoft could not verify the connected account.");
  const data = z
    .object({ id: z.string(), displayName: z.string(), userPrincipalName: z.string().optional() })
    .parse(await response.json());
  return {
    id: data.id,
    displayName: data.displayName,
    metadata: { email: data.userPrincipalName },
  };
}

export const finishConnectorConnection = createServerFn({ method: "POST" })
  .validator(
    z.object({
      connectorId: oauthConnectorSchema,
      code: z.string().min(4).max(4096),
      state: z.string().min(16).max(1024),
    }),
  )
  .handler(async ({ data }) => {
    const session = await getCurrentSession();
    if (!session?.workspaceId || !verifyConnectorOAuthState(data.state))
      throw new Error("The connector OAuth state is invalid or your session expired.");
    const admin = getSupabaseAdminClient() as unknown as GenericDb;
    const stateHash = sha256Hex(data.state);
    const { data: stored, error: stateError } = await admin
      .from("oauth_states")
      .select("id,connector_id,code_verifier_encrypted,return_url")
      .eq("workspace_id", session.workspaceId)
      .eq("user_id", session.id)
      .eq("state_hash", stateHash)
      .eq("connector_id", data.connectorId)
      .is("consumed_at", null)
      .gt("expires_at", new Date().toISOString())
      .single();
    if (stateError || !stored)
      throw new Error("The connector OAuth request expired or was already used.");
    await admin
      .from("oauth_states")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", stored.id);
    const config = getConnectorOAuthConfig(data.connectorId);
    const verifier = decryptSecret(
      String(stored.code_verifier_encrypted),
      connectorEncryptionKey(),
    );
    const tokenResponse = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: data.code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: callbackUrl(data.connectorId),
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!tokenResponse.ok)
      throw new Error(`${data.connectorId} rejected the one-time authorization code.`);
    const tokens = tokenSchema.parse(await tokenResponse.json());
    const identity = await providerIdentity(data.connectorId, tokens.access_token);
    const scopes = tokens.scope?.split(/[ ,]+/).filter(Boolean) ?? config.scopes;
    const { error } = await admin.from("oauth_connections").upsert(
      {
        workspace_id: session.workspaceId,
        user_id: session.id,
        provider: config.provider,
        connector_id: data.connectorId,
        provider_account_id: identity.id,
        display_name: identity.displayName,
        access_token_encrypted: encryptSecret(tokens.access_token, connectorEncryptionKey()),
        refresh_token_encrypted: tokens.refresh_token
          ? encryptSecret(tokens.refresh_token, connectorEncryptionKey())
          : null,
        token_expires_at: tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
          : null,
        scopes,
        capabilities: ["browse", "search", "download_original"],
        status: "connected",
        error_code: null,
        connected_at: new Date().toISOString(),
        last_verified_at: new Date().toISOString(),
        revoked_at: null,
        metadata_json: identity.metadata,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider" },
    );
    if (error) throw new Error(`The connector account could not be stored: ${error.message}`);
    return {
      returnTo: safeReturnPath(String(stored.return_url)),
      connectorId: data.connectorId,
      displayName: identity.displayName,
    };
  });
