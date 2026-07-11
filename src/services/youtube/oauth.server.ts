import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";
import { z } from "zod";
import { getServerEnv } from "@/config/env.server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentSession } from "@/services/auth/server";

const STATE_COOKIE = "vidrial.youtube.oauth.state";
function googleConfig() {
  const env = getServerEnv();
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY)
    throw new Error(
      "Google OAuth is not configured. Add the Google client credentials and token-encryption key.",
    );
  return { ...env, callback: `${env.PUBLIC_APP_URL}/auth/youtube/callback` };
}
function encrypt(value: string, keyMaterial: string) {
  const key = createHash("sha256").update(keyMaterial).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

export const beginYouTubeConnection = createServerFn({ method: "POST" }).handler(async () => {
  const session = await getCurrentSession();
  if (!session) throw new Error("Log in before connecting YouTube.");
  const config = googleConfig();
  const state = randomBytes(24).toString("base64url");
  setCookie(STATE_COOKIE, state, {
    httpOnly: true,
    secure: config.PUBLIC_APP_URL.startsWith("https:"),
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  const params = new URLSearchParams({
    client_id: config.GOOGLE_CLIENT_ID!,
    redirect_uri: config.callback,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/youtube.readonly",
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
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
    deleteCookie(STATE_COOKIE, { path: "/" });
    if (!expected || expected !== data.state)
      throw new Error("The OAuth state did not match. Start the connection again.");
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
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!tokenResponse.ok)
      throw new Error("Google rejected the OAuth code. Start the connection again.");
    const tokens = z
      .object({
        access_token: z.string(),
        refresh_token: z.string().optional(),
        expires_in: z.number(),
        scope: z.string().optional(),
      })
      .parse(await tokenResponse.json());
    const channelsResponse = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true",
      {
        headers: { authorization: `Bearer ${tokens.access_token}` },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!channelsResponse.ok) throw new Error("YouTube channel management could not be verified.");
    const channels = z
      .object({
        items: z.array(z.object({ id: z.string(), snippet: z.object({ title: z.string() }) })),
      })
      .parse(await channelsResponse.json()).items;
    const encryptedAccess = encrypt(tokens.access_token, config.GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY!);
    const encryptedRefresh = tokens.refresh_token
      ? encrypt(tokens.refresh_token, config.GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY!)
      : undefined;
    const { error } = await getSupabaseServerClient()
      .from("oauth_connections")
      .upsert(
        {
          workspace_id: session.workspaceId,
          user_id: session.id,
          provider: "google_youtube",
          access_token_encrypted: encryptedAccess,
          refresh_token_encrypted: encryptedRefresh,
          token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
          scopes: tokens.scope?.split(" ") ?? [],
          provider_account_id: channels[0]?.id,
          metadata_json: {
            channels: channels.map((channel) => ({ id: channel.id, title: channel.snippet.title })),
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,provider" },
      );
    if (error) throw new Error(error.message);
    return {
      channels: channels.map((channel) => ({ id: channel.id, title: channel.snippet.title })),
    };
  });

export const getYouTubeConnection = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getCurrentSession();
  if (!session) return null;
  const { data } = await getSupabaseServerClient()
    .from("oauth_connections")
    .select("provider_account_id,metadata_json,updated_at")
    .eq("user_id", session.id)
    .eq("provider", "google_youtube")
    .maybeSingle();
  return data;
});

export const verifyYouTubeOwnership = createServerFn({ method: "POST" })
  .validator(z.object({ channelId: z.string().min(1).max(255) }))
  .handler(async ({ data }) => {
    const connection = await getYouTubeConnection();
    if (!connection) return { state: "unknown" as const };
    const metadata = connection.metadata_json as { channels?: { id: string }[] };
    return {
      state: metadata.channels?.some((channel) => channel.id === data.channelId)
        ? ("verified" as const)
        : ("unverified" as const),
    };
  });
