// @vitest-environment node
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import type { Database } from "@/lib/supabase/database.types";

type RpcClient = { rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }> };
type LooseQuery = PromiseLike<{ data: Record<string, unknown>[] | null; error: { message: string } | null }> & { select(columns?: string): LooseQuery; insert(value: Record<string, unknown>): LooseQuery; eq(column: string, value: unknown): LooseQuery };
type LooseClient = { from(table: string): LooseQuery };
const callRpc = (client: SupabaseClient<Database>, name: string, args: Record<string, unknown>) =>
  (client as unknown as RpcClient).rpc(name, args);

const enabled = process.env.RUN_SUPABASE_INTEGRATION === "1";
const suite = enabled ? describe : describe.skip;
suite(
  "Supabase authentication, RLS, usage, queue and watermark integration",
  () => {
    const url = process.env.SUPABASE_URL ?? "https://disabled-integration.supabase.co";
    const publishable =
      process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? "disabled-key";
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "disabled-secret";
    const admin = createClient<Database>(url, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const suffix = crypto.randomUUID().slice(0, 8);
    const password = `Test-${crypto.randomUUID()}!`;
    let userA = "";
    let userB = "";
    let workspaceA = "";
    let jobId = "";
    let clipId = "";
    let versionId = "";
    let objectPath = "";
    let clientA: SupabaseClient<Database>;
    let clientB: SupabaseClient<Database>;
    beforeAll(
      async () => {
        for (const label of ["a", "b"]) {
          const { data, error } = await admin.auth.admin.createUser({
            email: `vidrial-integration-${label}-${suffix}@example.com`,
            password,
            email_confirm: true,
          });
          if (error) throw error;
          if (label === "a") userA = data.user.id;
          else userB = data.user.id;
        }
        const { data: member, error: memberError } = await admin
          .from("workspace_members")
          .select("workspace_id")
          .eq("user_id", userA)
          .single();
        if (memberError) throw memberError;
        workspaceA = member.workspace_id;
        clientA = createClient<Database>(url, publishable, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        clientB = createClient<Database>(url, publishable, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        await clientA.auth.signInWithPassword({
          email: `vidrial-integration-a-${suffix}@example.com`,
          password,
        });
        await clientB.auth.signInWithPassword({
          email: `vidrial-integration-b-${suffix}@example.com`,
          password,
        });
      },
      30_000,
    );
    afterAll(
      async () => {
        if (objectPath) await admin.storage.from("job-artifacts").remove([objectPath]);
        if (userA) await admin.auth.admin.deleteUser(userA);
        if (userB) await admin.auth.admin.deleteUser(userB);
      },
      30_000,
    );
    it("creates a job, rights record, usage reservation and durable direct-source task atomically", async () => {
      const { data, error } = await callRpc(clientA, "create_clip_job", {
        p_workspace_id: workspaceA,
        p_source_type: "direct_owned_media_url",
        p_source_url: "https://media.example.com/owned.mp4",
        p_source_identifier: null,
        p_source_duration_seconds: 60,
        p_source_asset_id: null,
        p_source_metadata: { title: "Integration source" },
        p_settings: {},
        p_requested_clip_count: 1,
        p_attestation_version: "youtube-clipper-rights-v1",
        p_policy_version: "vidrial-content-policy-v1",
        p_request_metadata: { client: "integration" },
        p_idempotency_key: crypto.randomUUID(),
      });
      expect(error).toBeNull();
      jobId = z.string().uuid().parse(data);
      const [{ data: rights }, { data: task }, { data: period }] = await Promise.all([
        admin.from("rights_attestations").select("id").eq("clip_job_id", jobId).single(),
        admin.from("job_tasks").select("task_type,status").eq("clip_job_id", jobId).single(),
        admin
          .from("usage_periods")
          .select("source_seconds_reserved")
          .eq("workspace_id", workspaceA)
          .single(),
      ]);
      expect(rights).toBeTruthy();
      expect(task).toMatchObject({ task_type: "download_direct_source", status: "queued" });
      expect(period?.source_seconds_reserved).toBeGreaterThanOrEqual(60);
    });
    it("isolates cross-user jobs and plan changes with RLS", async () => {
      const { data: foreign } = await clientB.from("clip_jobs").select("id").eq("id", jobId);
      expect(foreign).toEqual([]);
      await clientB.from("profiles").update({ plan_key: "pro" }).eq("id", userA);
      const { data: profile } = await admin
        .from("profiles")
        .select("plan_key")
        .eq("id", userA)
        .single();
      expect(profile?.plan_key).toBe("free");
    });
    it("isolates connector waitlists across workspaces", async () => {
      const own = clientA as unknown as LooseClient;
      const foreign = clientB as unknown as LooseClient;
      const { error } = await own.from("connector_waitlist").insert({ workspace_id: workspaceA, user_id: userA, connector_id: "twitch" });
      expect(error).toBeNull();
      const { data } = await foreign.from("connector_waitlist").select("connector_id").eq("workspace_id", workspaceA);
      expect(data).toEqual([]);
    });
    it("prevents signed URLs for another workspace", async () => {
      objectPath = `${workspaceA}/${userA}/${jobId}/artifact/test.txt`;
      const { error: uploadError } = await admin.storage
        .from("job-artifacts")
        .upload(objectPath, new Blob(["private"]));
      expect(uploadError).toBeNull();
      const { data, error } = await clientB.storage
        .from("job-artifacts")
        .createSignedUrl(objectPath, 60);
      expect(data).toBeNull();
      expect(error).toBeTruthy();
    });
    it("enforces export ownership and serialises the free trial watermark race", async () => {
      const { data: run, error: runError } = await admin
        .from("planning_runs")
        .insert({
          clip_job_id: jobId,
          provider: "test",
          model: "test",
          prompt_version: "v1",
          schema_version: "v1",
          status: "succeeded",
        })
        .select("id")
        .single();
      if (runError) throw runError;
      const { data: candidate, error: candidateError } = await admin
        .from("clip_candidates")
        .insert({
          clip_job_id: jobId,
          planning_run_id: run.id,
          start_seconds: 0,
          end_seconds: 30,
          title: "Test clip",
          hook: "Hook",
          summary: "Summary",
          topic: "Test",
          transcript_excerpt: "Complete thought",
          standalone_score: 90,
          hook_score: 90,
          clarity_score: 90,
          story_score: 90,
          relevance_score: 90,
          technical_score: 90,
          overall_score: 90,
          selection_reason: "Complete",
          status: "selected",
        })
        .select("id")
        .single();
      if (candidateError) throw candidateError;
      const { data: clip, error: clipError } = await admin
        .from("clips")
        .insert({
          clip_job_id: jobId,
          clip_candidate_id: candidate.id,
          title: "Test clip",
          status: "ready",
          selected: true,
          duration_seconds: 30,
        })
        .select("id")
        .single();
      if (clipError) throw clipError;
      clipId = clip.id;
      const { data: version, error: versionError } = await admin
        .from("clip_versions")
        .insert({
          clip_id: clipId,
          version_number: 1,
          created_by: userA,
          created_source: "manual",
          edit_manifest_json: { startSeconds: 0, endSeconds: 30 },
          transcript_edits_json: {},
          caption_settings_json: {},
          crop_settings_json: {},
          audio_settings_json: {},
          text_overlays_json: [],
        })
        .select("id")
        .single();
      if (versionError) throw versionError;
      versionId = version.id;
      await admin.from("clips").update({ current_version_id: versionId }).eq("id", clipId);
      const { error: foreignExport } = await callRpc(clientB, "request_clip_export", {
        p_clip_id: clipId,
        p_clip_version_id: versionId,
        p_export_type: "individual",
        p_caption_mode: "both",
        p_idempotency_key: crypto.randomUUID(),
      });
      expect(foreignExport).toBeTruthy();
      await admin
        .from("profiles")
        .update({ plan_key: "free", trial_unwatermarked_exports_used: 0 })
        .eq("id", userA);
      const results = await Promise.all([
        callRpc(clientA, "request_clip_export", {
          p_clip_id: clipId,
          p_clip_version_id: versionId,
          p_export_type: "individual",
          p_caption_mode: "both",
          p_idempotency_key: crypto.randomUUID(),
        }),
        callRpc(clientA, "request_clip_export", {
          p_clip_id: clipId,
          p_clip_version_id: versionId,
          p_export_type: "individual",
          p_caption_mode: "both",
          p_idempotency_key: crypto.randomUUID(),
        }),
      ]);
      expect(results.every((result) => !result.error)).toBe(true);
      const watermarks = results
        .map((result) => z.object({ watermarked: z.boolean() }).parse(result.data).watermarked)
        .sort();
      expect(watermarks).toEqual([false, true]);
    });
  },
  60_000,
);
