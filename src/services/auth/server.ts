import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getServerEnv } from "@/config/env.server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const credentialsSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(128),
});

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
  return {
    id: data.user.id,
    email: data.user.email ?? "",
    name: profile?.display_name ?? data.user.user_metadata.display_name ?? "Vidrial user",
    avatarUrl: profile?.avatar_url ?? null,
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
  .validator(credentialsSchema.extend({ displayName: z.string().trim().min(2).max(80) }))
  .handler(async ({ data }) => {
    const env = getServerEnv();
    const { error } = await getSupabaseServerClient().auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { display_name: data.displayName },
        emailRedirectTo: `${env.PUBLIC_APP_URL}/verify-email`,
      },
    });
    if (error) throw authError(error.message);
    return { ok: true };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const { error } = await getSupabaseServerClient().auth.signOut();
  if (error) throw authError(error.message);
  return { ok: true };
});

export const requestPasswordReset = createServerFn({ method: "POST" })
  .validator(z.object({ email: z.string().email().max(320) }))
  .handler(async ({ data }) => {
    const env = getServerEnv();
    const { error } = await getSupabaseServerClient().auth.resetPasswordForEmail(data.email, {
      redirectTo: `${env.PUBLIC_APP_URL}/reset-password`,
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
    if (error) throw authError(error.message);
    return { ok: true };
  });
