import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase/server";

async function currentUser() {
  const { data, error } = await getSupabaseServerClient().auth.getUser();
  if (error || !data.user) throw new Error("Your session expired. Sign in again.");
  return data.user;
}

export const exportMyData = createServerFn({ method: "POST" }).handler(async () => {
  const user = await currentUser();
  const client = getSupabaseServerClient();
  const [
    profile,
    memberships,
    projects,
    assets,
    jobs,
    versions,
    exports,
    connections,
    rules,
    drafts,
  ] = await Promise.all([
    client.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    client.from("workspace_members").select("*").eq("user_id", user.id),
    client.from("app_projects").select("*").eq("user_id", user.id),
    client
      .from("media_assets")
      .select(
        "id,project_id,display_name,mime_type,size_bytes,duration_seconds,status,created_at,deleted_at",
      )
      .eq("user_id", user.id),
    client.from("clip_jobs").select("*").eq("user_id", user.id),
    client
      .from("project_versions")
      .select("id,project_id,label,kind,summary,created_at")
      .eq("user_id", user.id),
    client
      .from("exports")
      .select(
        "id,clip_job_id,clip_id,format,resolution,status,watermarked,size_bytes,created_at,completed_at,expires_at",
      )
      .eq("user_id", user.id),
    client
      .from("oauth_connections")
      .select("id,provider,status,capabilities,last_verified_at,created_at,updated_at")
      .eq("user_id", user.id),
    client.from("automation_rules").select("*").eq("user_id", user.id),
    client.from("automation_drafts").select("*").eq("user_id", user.id),
  ]);
  const jobIds = (jobs.data ?? []).map((job) => job.id);
  const clips = jobIds.length
    ? await client.from("clips").select("*").in("clip_job_id", jobIds)
    : { data: [], error: null };
  const failed = [
    profile,
    memberships,
    projects,
    assets,
    jobs,
    clips,
    versions,
    exports,
    connections,
    rules,
    drafts,
  ].find((result) => result.error);
  if (failed?.error) throw new Error(`Data export could not be prepared: ${failed.error.message}`);
  return {
    exportedAt: new Date().toISOString(),
    formatVersion: 1,
    account: { id: user.id, email: user.email, createdAt: user.created_at },
    profile: profile.data,
    memberships: memberships.data ?? [],
    projects: projects.data ?? [],
    mediaAssets: assets.data ?? [],
    clippingJobs: jobs.data ?? [],
    clips: clips.data ?? [],
    projectVersions: versions.data ?? [],
    exports: exports.data ?? [],
    connections: connections.data ?? [],
    automationRules: rules.data ?? [],
    automationDrafts: drafts.data ?? [],
  };
});

export const deleteMyAccount = createServerFn({ method: "POST" })
  .validator(z.object({ confirmation: z.literal("DELETE") }))
  .handler(async () => {
    const user = await currentUser();
    const admin = getSupabaseAdminClient();
    const [{ data: assets }, { data: exports }] = await Promise.all([
      admin.from("media_assets").select("storage_bucket,storage_path").eq("user_id", user.id),
      admin.from("exports").select("storage_bucket,storage_path").eq("user_id", user.id),
    ]);
    const grouped = new Map<string, string[]>();
    for (const item of [...(assets ?? []), ...(exports ?? [])]) {
      if (!item.storage_bucket || !item.storage_path) continue;
      grouped.set(item.storage_bucket, [
        ...(grouped.get(item.storage_bucket) ?? []),
        item.storage_path,
      ]);
    }
    for (const [bucket, paths] of grouped) {
      const { error } = await admin.storage.from(bucket).remove(paths);
      if (error) throw new Error(`Stored account data could not be removed: ${error.message}`);
    }
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw new Error(`Account could not be deleted: ${error.message}`);
    return { ok: true };
  });
