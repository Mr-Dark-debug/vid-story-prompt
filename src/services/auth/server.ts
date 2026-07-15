import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getServerEnv } from "@/config/env.server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { verifyTurnstile } from "@/services/security/turnstile.server";
import { logAuthFailure } from "./diagnostics";
import { resolveAuthProfile } from "./profile";

const credentialsSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(128),
});

const redirectSchema = z.string().max(2048).optional();
const turnstileTokenSchema = z.string().min(1).max(4096).optional();

function safeAppPath(value?: string) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/app";
}

function authCallbackUrl(next?: string) {
  const env = getServerEnv();
  const callback = new URL("/auth/callback", env.PUBLIC_APP_URL);
  callback.searchParams.set("next", safeAppPath(next));
  return callback.toString();
}

function authError(message: string) {
  return new Error(message.replace(/\.$/, ""));
}

export const getCurrentSession = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name,avatar_url,plan_key")
      .eq("id", data.user.id)
      .maybeSingle(),
    supabase
      .from("workspace_members")
      .select("workspace_id,role")
      .eq("user_id", data.user.id)
      .order("created_at")
      .limit(1)
      .maybeSingle(),
  ]);
  const resolvedProfile = resolveAuthProfile(data.user, profile);
  return {
    id: data.user.id,
    email: data.user.email ?? "",
    name: resolvedProfile.name,
    avatarUrl: resolvedProfile.avatarUrl,
    plan: profile?.plan_key ?? "free",
    workspaceId: membership?.workspace_id ?? null,
    workspaceRole: membership?.role ?? null,
  };
});

export const login = createServerFn({ method: "POST" })
  .validator(credentialsSchema)
  .handler(async ({ data }) => {
    const { error } = await getSupabaseServerClient().auth.signInWithPassword(data);
    if (error) throw authError(error.message);
    return { ok: true };
  });

export const signup = createServerFn({ method: "POST" })
  .validator(
    credentialsSchema.extend({
      displayName: z.string().trim().min(2).max(80),
      redirect: redirectSchema,
      turnstileToken: turnstileTokenSchema,
    }),
  )
  .handler(async ({ data }) => {
    await verifyTurnstile(data.turnstileToken, "signup");
    const { data: result, error } = await getSupabaseServerClient().auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { display_name: data.displayName },
        emailRedirectTo: authCallbackUrl(data.redirect),
      },
    });
    if (error) throw authError(error.message);
    return { ok: true, requiresEmailConfirmation: !result.session };
  });

export const beginGoogleSignIn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      intent: z.enum(["login", "signup"]),
      redirect: redirectSchema,
      turnstileToken: turnstileTokenSchema,
    }),
  )
  .handler(async ({ data }) => {
    if (data.intent === "signup") await verifyTurnstile(data.turnstileToken, "signup");
    const { data: result, error } = await getSupabaseServerClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: authCallbackUrl(data.redirect),
        scopes: "openid email profile",
        queryParams: {
          prompt: "select_account",
        },
      },
    });
    if (error) {
      logAuthFailure("google_begin", error);
      throw new Error("Google sign-in could not be started. Please retry.");
    }
    if (!result.url) {
      logAuthFailure("google_begin", { code: "missing_provider_url" });
      throw new Error("Google sign-in could not be started. Please retry.");
    }
    return { url: result.url };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const { error } = await getSupabaseServerClient().auth.signOut();
  if (error) throw authError(error.message);
  return { ok: true };
});

export const requestPasswordReset = createServerFn({ method: "POST" })
  .validator(z.object({ email: z.string().email().max(320) }))
  .handler(async ({ data }) => {
    const { error } = await getSupabaseServerClient().auth.resetPasswordForEmail(data.email, {
      redirectTo: authCallbackUrl("/reset-password"),
    });
    if (error) throw authError(error.message);
    return { ok: true };
  });

export const resetPassword = createServerFn({ method: "POST" })
  .validator(z.object({ password: z.string().min(8).max(128) }))
  .handler(async ({ data }) => {
    const { error } = await getSupabaseServerClient().auth.updateUser({ password: data.password });
    if (error) throw authError(error.message);
    return { ok: true };
  });

export const exchangeAuthCode = createServerFn({ method: "POST" })
  .validator(z.object({ code: z.string().min(8).max(2048) }))
  .handler(async ({ data }) => {
    const { error } = await getSupabaseServerClient().auth.exchangeCodeForSession(data.code);
    if (error) {
      logAuthFailure("oauth_exchange", error);
      throw new Error(
        "The secure sign-in could not be completed. Start again from the sign-in page.",
      );
    }
    return { ok: true };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .validator(z.object({ displayName: z.string().trim().min(2).max(80) }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) throw new Error("Your session expired. Sign in again");
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: data.displayName, updated_at: new Date().toISOString() })
      .eq("id", userData.user.id);
    if (error) throw authError(error.message);
    const { error: metadataError } = await supabase.auth.updateUser({
      data: { display_name: data.displayName },
    });
    if (metadataError) throw authError(metadataError.message);
    return { ok: true };
  });
