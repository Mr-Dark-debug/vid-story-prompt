import { createHash, randomBytes } from "node:crypto";
import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";
import { z } from "zod";
import { getServerEnv } from "@/config/env.server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getCurrentSession } from "@/services/auth/server";
import { youtubeCapabilitySchema, type YouTubeCapability } from "./integration.types";
import {
  decryptSecret,
  encryptSecret,
  safeReturnPath,
  secureTextEqual,
} from "./token-crypto.server";

const COOKIE_PREFIX = "vidrial.youtube.oauth";
const STATE_COOKIE = `${COOKIE_PREFIX}.state`;
const VERIFIER_COOKIE = `${COOKIE_PREFIX}.verifier`;
const CAPABILITY_COOKIE = `${COOKIE_PREFIX}.capability`;
const RETURN_COOKIE = `${COOKIE_PREFIX}.return`;
const READ_SCOPE = "https://www.googleapis.com/auth/youtube.readonly";
const UPLOAD_SCOPE = "https://www.googleapis.com/auth/youtube.upload";
const randomToken = createServerOnlyFn((bytes: number) => randomBytes(bytes).toString("base64url"));
const sha256Base64Url = createServerOnlyFn((value: string) =>
  createHash("sha256").update(value).digest("base64url"),
);

function googleConfig() {
  const env = getServerEnv();
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY)
    throw new Error(
      "YouTube connection is unavailable until Google OAuth credentials and token encryption are configured.",
    );
  return { ...env, callback: new URL("/auth/youtube/callback", env.PUBLIC_APP_URL).toString() };
}

function cookieOptions(publicUrl: string) {
  return {
    httpOnly: true,
    secure: publicUrl.startsWith("https:"),
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600,
  };
}

function clearOAuthCookies() {
  for (const name of [STATE_COOKIE, VERIFIER_COOKIE, CAPABILITY_COOKIE, RETURN_COOKIE])
    deleteCookie(name, { path: "/" });
}

function requestedScopes(capability: YouTubeCapability) {
  return capability === "video_publish" ? [READ_SCOPE, UPLOAD_SCOPE] : [READ_SCOPE];
}

const channelResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      snippet: z.object({
        title: z.string(),
        thumbnails: z.record(z.string(), z.object({ url: z.string().url() })).optional(),
      }),
      contentDetails: z
        .object({ relatedPlaylists: z.object({ uploads: z.string().optional() }) })
        .optional(),
    }),
  ),
});

const beginInputSchema = z.object({
  capability: youtubeCapabilitySchema.default("channel_read"),
  returnTo: z.string().max(1024).optional(),
});

export const beginYouTubeConnection = createServerFn({ method: "POST" })
  .validator(beginInputSchema)
  .handler(async ({ data }) => {
    const session = await getCurrentSession();
    if (!session) throw new Error("Log in before connecting YouTube.");
    const config = googleConfig();
    const state = randomToken(32);
    const verifier = randomToken(48);
    const challenge = sha256Base64Url(verifier);
    const options = cookieOptions(config.PUBLIC_APP_URL);
    setCookie(STATE_COOKIE, state, options);
    setCookie(VERIFIER_COOKIE, verifier, options);
    setCookie(CAPABILITY_COOKIE, data.capability, options);
    setCookie(RETURN_COOKIE, safeReturnPath(data.returnTo), options);

    const params = new URLSearchParams({
      client_id: config.GOOGLE_CLIENT_ID!,
      redirect_uri: config.callback,
      response_type: "code",
      scope: requestedScopes(data.capability).join(" "),
      access_type: "offline",
      include_granted_scopes: "true",
      prompt: "consent",
      code_challenge: challenge,
      code_challenge_method: "S256",
      state,
    });
    return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` };
  });

export const finishYouTubeConnection = createServerFn({ method: "POST" })
  .validator(z.object({ code: z.string().min(8).max(4096), state: z.string().min(8).max(512) }))
  .handler(async ({ data }) => {
    const session = await getCurrentSession();
    if (!session?.workspaceId) throw new Error("Your session expired. Start the connection again.");
    const expected = getCookie(STATE_COOKIE);
    const verifier = getCookie(VERIFIER_COOKIE);
    const capability = youtubeCapabilitySchema.safeParse(getCookie(CAPABILITY_COOKIE));
    const returnTo = safeReturnPath(getCookie(RETURN_COOKIE));
    clearOAuthCookies();
    if (!expected || !secureTextEqual(expected, data.state) || !verifier || !capability.success)
      throw new Error("The YouTube connection request expired or did not match. Start it again.");

    const config = googleConfig();
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: data.code,
        client_id: config.GOOGLE_CLIENT_ID!,
        client_secret: config.GOOGLE_CLIENT_SECRET!,
        redirect_uri: config.callback,
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!tokenResponse.ok)
      throw new Error("Google rejected the one-time YouTube code. Restart the connection.");
    const tokens = z
      .object({
        access_token: z.string(),
        refresh_token: z.string().optional(),
        expires_in: z.number().int().positive(),
        scope: z.string().optional(),
      })
      .parse(await tokenResponse.json());

    const grantedScopes = new Set(tokens.scope?.split(" ").filter(Boolean) ?? []);
    if (!grantedScopes.has(READ_SCOPE))
      throw new Error("Google did not grant permission to read the selected YouTube channel.");
    if (capability.data === "video_publish" && !grantedScopes.has(UPLOAD_SCOPE))
      throw new Error("Google did not grant YouTube publishing permission.");

    const channelsResponse = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=id,snippet,contentDetails&mine=true",
      {
        headers: { authorization: `Bearer ${tokens.access_token}` },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!channelsResponse.ok) {
      const responseBody = await channelsResponse.json().catch(() => null);
      const parsedError = z
        .object({
          error: z
            .object({
              errors: z.array(z.object({ reason: z.string().optional() })).optional(),
              status: z.string().optional(),
            })
            .optional(),
        })
        .safeParse(responseBody);
      const providerReason = parsedError.success
        ? (parsedError.data.error?.errors?.[0]?.reason ?? parsedError.data.error?.status)
        : undefined;
      if (providerReason === "youtubeSignupRequired")
        throw new Error(
          "This Google identity has no active YouTube channel. Create or restore the channel in YouTube, then connect it again.",
        );
      throw new Error(
        `YouTube could not read this channel (${providerReason ?? channelsResponse.status}). Check that the channel exists and YouTube Data API access is enabled.`,
      );
    }
    const channels = channelResponseSchema.parse(await channelsResponse.json()).items;
    if (!channels.length) throw new Error("The connected Google account has no YouTube channel.");

    const admin = getSupabaseAdminClient();
    const { data: existing } = await admin
      .from("oauth_connections")
      .select("id,refresh_token_encrypted,capabilities")
      .eq("user_id", session.id)
      .eq("provider", "google_youtube")
      .maybeSingle();
    const capabilities = new Set(existing?.capabilities ?? []);
    capabilities.add("channel_read");
    if (grantedScopes.has(UPLOAD_SCOPE)) capabilities.add("video_publish");
    const encryptedRefresh = tokens.refresh_token
      ? encryptSecret(tokens.refresh_token, config.GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY!)
      : existing?.refresh_token_encrypted;
    if (!encryptedRefresh)
      throw new Error(
        "Google did not issue offline access. Reconnect and approve the consent request.",
      );

    const { data: connection, error } = await admin
      .from("oauth_connections")
      .upsert(
        {
          workspace_id: session.workspaceId,
          user_id: session.id,
          provider: "google_youtube",
          access_token_encrypted: encryptSecret(
            tokens.access_token,
            config.GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY!,
          ),
          refresh_token_encrypted: encryptedRefresh,
          token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
          scopes: [...grantedScopes],
          capabilities: [...capabilities],
          token_version: 1,
          provider_account_id: channels[0].id,
          metadata_json: { channelCount: channels.length },
          status: "connected",
          last_verified_at: new Date().toISOString(),
          last_error_code: null,
          disconnected_at: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,provider" },
      )
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const channelRows = channels.map((channel, index) => ({
      connection_id: connection.id,
      workspace_id: session.workspaceId!,
      user_id: session.id,
      provider_channel_id: channel.id,
      title: channel.snippet.title,
      avatar_url:
        channel.snippet.thumbnails?.high?.url ??
        channel.snippet.thumbnails?.medium?.url ??
        channel.snippet.thumbnails?.default?.url ??
        null,
      uploads_playlist_id: channel.contentDetails?.relatedPlaylists.uploads ?? null,
      selected: index === 0,
      last_observed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    const { error: channelError } = await admin
      .from("youtube_channels")
      .upsert(channelRows, { onConflict: "connection_id,provider_channel_id" });
    if (channelError) throw new Error(channelError.message);

    return { returnTo, capability: capability.data, channels: channelRows };
  });

export const getYouTubeConnection = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getCurrentSession();
  if (!session?.workspaceId) return null;
  const admin = getSupabaseAdminClient();
  const { data: connection } = await admin
    .from("oauth_connections")
    .select("id,status,capabilities,scopes,last_verified_at,last_error_code,updated_at")
    .eq("user_id", session.id)
    .eq("workspace_id", session.workspaceId)
    .eq("provider", "google_youtube")
    .maybeSingle();
  if (!connection) return null;
  const { data: channels } = await admin
    .from("youtube_channels")
    .select("id,provider_channel_id,title,avatar_url,uploads_playlist_id,selected,last_observed_at")
    .eq("connection_id", connection.id)
    .order("selected", { ascending: false });
  const channelIds = (channels ?? []).map((channel) => channel.id);
  const { data: rules } = channelIds.length
    ? await admin.from("automation_rules").select("*").in("youtube_channel_id", channelIds)
    : { data: [] };
  const { data: subscriptions } = channelIds.length
    ? await admin
        .from("youtube_subscriptions")
        .select("youtube_channel_id,status,lease_expires_at,last_error_code")
        .in("youtube_channel_id", channelIds)
    : { data: [] };
  return {
    ...connection,
    channels: channels ?? [],
    rules: rules ?? [],
    subscriptions: subscriptions ?? [],
  };
});

export const verifyYouTubeOwnership = createServerFn({ method: "POST" })
  .validator(z.object({ channelId: z.string().min(1).max(255) }))
  .handler(async ({ data }) => {
    const connection = await getYouTubeConnection();
    if (!connection || connection.status !== "connected") return { state: "unknown" as const };
    return {
      state: connection.channels.some((channel) => channel.provider_channel_id === data.channelId)
        ? ("verified" as const)
        : ("unverified" as const),
    };
  });

export const disconnectYouTube = createServerFn({ method: "POST" }).handler(async () => {
  const session = await getCurrentSession();
  if (!session?.workspaceId) throw new Error("Your session expired.");
  const config = googleConfig();
  const admin = getSupabaseAdminClient();
  const { data: connection } = await admin
    .from("oauth_connections")
    .select("id,access_token_encrypted,refresh_token_encrypted")
    .eq("user_id", session.id)
    .eq("workspace_id", session.workspaceId)
    .eq("provider", "google_youtube")
    .maybeSingle();
  if (!connection) return { ok: true };
  const encrypted = connection.refresh_token_encrypted ?? connection.access_token_encrypted;
  if (encrypted) {
    try {
      const token = decryptSecret(encrypted, config.GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY!);
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        signal: AbortSignal.timeout(8_000),
      });
    } catch {
      // Local revocation still completes when Google is temporarily unreachable.
    }
  }
  const { data: channels } = await admin
    .from("youtube_channels")
    .select("id")
    .eq("connection_id", connection.id);
  const ids = (channels ?? []).map((channel) => channel.id);
  if (ids.length) {
    await Promise.all([
      admin.from("automation_rules").update({ enabled: false }).in("youtube_channel_id", ids),
      admin
        .from("youtube_subscriptions")
        .update({ status: "disabled" })
        .in("youtube_channel_id", ids),
    ]);
  }
  const { error } = await admin
    .from("oauth_connections")
    .update({
      access_token_encrypted: null,
      refresh_token_encrypted: null,
      status: "revoked",
      disconnected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", connection.id);
  if (error) throw new Error(error.message);
  return { ok: true };
});
