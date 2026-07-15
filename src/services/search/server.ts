import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const searchSchema = z.object({ query: z.string().trim().min(2).max(100) });

export type WorkspaceSearchResult =
  | {
      type: "project";
      id: string;
      title: string;
      detail: string;
      to: string;
    }
  | {
      type: "upload";
      id: string;
      title: string;
      detail: string;
      to: string;
    }
  | {
      type: "clipping-job";
      id: string;
      title: string;
      detail: string;
      to: string;
    };

export function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

export const searchWorkspace = createServerFn({ method: "GET" })
  .validator(searchSchema)
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) throw new Error("Your session expired. Sign in again.");

    const { data: membership, error: membershipError } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", authData.user.id)
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (membershipError || !membership?.workspace_id) {
      throw new Error("Your workspace could not be loaded. Please refresh and try again.");
    }

    const pattern = `%${escapeLikePattern(data.query)}%`;
    const workspaceId = membership.workspace_id;
    const [projects, uploads, jobs] = await Promise.all([
      supabase
        .from("app_projects")
        .select("id,name,status,updated_at")
        .eq("workspace_id", workspaceId)
        .ilike("name", pattern)
        .order("updated_at", { ascending: false })
        .limit(6),
      supabase
        .from("media_assets")
        .select("id,display_name,status,updated_at")
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null)
        .ilike("display_name", pattern)
        .order("updated_at", { ascending: false })
        .limit(6),
      supabase
        .from("clip_jobs")
        .select("id,source_title,status,updated_at")
        .eq("workspace_id", workspaceId)
        .ilike("source_title", pattern)
        .order("updated_at", { ascending: false })
        .limit(6),
    ]);

    const error = projects.error ?? uploads.error ?? jobs.error;
    if (error) throw new Error("Search is temporarily unavailable. Please try again.");

    const results: WorkspaceSearchResult[] = [
      ...(projects.data ?? []).map((project) => ({
        type: "project" as const,
        id: project.id,
        title: project.name,
        detail: `Project · ${project.status}`,
        to: `/app/projects/${project.id}`,
      })),
      ...(uploads.data ?? []).map((upload) => ({
        type: "upload" as const,
        id: upload.id,
        title: upload.display_name,
        detail: `Upload · ${upload.status}`,
        to: "/app/uploads",
      })),
      ...(jobs.data ?? []).map((job) => ({
        type: "clipping-job" as const,
        id: job.id,
        title: job.source_title || "Untitled clipping job",
        detail: `Clipping job · ${job.status}`,
        to: `/app/youtube-clipper/jobs/${job.id}`,
      })),
    ];
    return results;
  });
