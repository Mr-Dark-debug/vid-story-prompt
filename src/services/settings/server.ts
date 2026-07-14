import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentSession } from "@/services/auth/server";

const editorDefaults = {
  aiPlanPreview: true,
  autosaveSeconds: 30,
  snapToWords: true,
  lowResolutionPreview: false,
};

const notificationDefaults = {
  exportComplete: true,
  aiPlanComplete: true,
  weeklyUsage: false,
  productUpdates: false,
};

async function requireSession() {
  const session = await getCurrentSession();
  if (!session?.workspaceId) throw new Error("Your workspace session expired. Sign in again.");
  return { ...session, workspaceId: session.workspaceId };
}

export const getAccountPreferences = createServerFn({ method: "GET" }).handler(async () => {
  const session = await requireSession();
  const { data, error } = await getSupabaseServerClient()
    .from("user_preferences")
    .select("*")
    .eq("user_id", session.id)
    .maybeSingle();
  if (error) throw new Error(`Preferences could not be loaded: ${error.message}`);
  return {
    editor: data ? {
      aiPlanPreview: data.ai_plan_preview,
      autosaveSeconds: data.autosave_seconds,
      snapToWords: data.snap_to_words,
      lowResolutionPreview: data.low_resolution_preview,
    } : editorDefaults,
    notifications: data ? {
      exportComplete: data.notify_export_complete,
      aiPlanComplete: data.notify_ai_plan_complete,
      weeklyUsage: data.notify_weekly_usage,
      productUpdates: data.notify_product_updates,
    } : notificationDefaults,
    saved: Boolean(data),
  };
});

export const saveEditorPreferences = createServerFn({ method: "POST" })
  .validator(z.object({
    aiPlanPreview: z.boolean(),
    autosaveSeconds: z.number().int().refine((value) => [0, 15, 30, 60, 120].includes(value)),
    snapToWords: z.boolean(),
    lowResolutionPreview: z.boolean(),
  }))
  .handler(async ({ data }) => {
    const session = await requireSession();
    const current = await getAccountPreferences();
    const { error } = await getSupabaseServerClient().from("user_preferences").upsert({
      user_id: session.id,
      workspace_id: session.workspaceId,
      ai_plan_preview: data.aiPlanPreview,
      autosave_seconds: data.autosaveSeconds,
      snap_to_words: data.snapToWords,
      low_resolution_preview: data.lowResolutionPreview,
      notify_export_complete: current.notifications.exportComplete,
      notify_ai_plan_complete: current.notifications.aiPlanComplete,
      notify_weekly_usage: current.notifications.weeklyUsage,
      notify_product_updates: current.notifications.productUpdates,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) throw new Error(`Preferences could not be saved: ${error.message}`);
    return { ok: true };
  });

export const saveNotificationPreferences = createServerFn({ method: "POST" })
  .validator(z.object({
    exportComplete: z.boolean(),
    aiPlanComplete: z.boolean(),
    weeklyUsage: z.boolean(),
    productUpdates: z.boolean(),
  }))
  .handler(async ({ data }) => {
    const session = await requireSession();
    const current = await getAccountPreferences();
    const { error } = await getSupabaseServerClient().from("user_preferences").upsert({
      user_id: session.id,
      workspace_id: session.workspaceId,
      ai_plan_preview: current.editor.aiPlanPreview,
      autosave_seconds: current.editor.autosaveSeconds,
      snap_to_words: current.editor.snapToWords,
      low_resolution_preview: current.editor.lowResolutionPreview,
      notify_export_complete: data.exportComplete,
      notify_ai_plan_complete: data.aiPlanComplete,
      notify_weekly_usage: data.weeklyUsage,
      notify_product_updates: data.productUpdates,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) throw new Error(`Notification preferences could not be saved: ${error.message}`);
    return { ok: true };
  });

export const resetAccountPreferences = createServerFn({ method: "POST" })
  .validator(z.object({ confirmation: z.literal("RESET") }))
  .handler(async () => {
    const session = await requireSession();
    const { error } = await getSupabaseServerClient()
      .from("user_preferences")
      .delete()
      .eq("user_id", session.id);
    if (error) throw new Error(`Preferences could not be reset: ${error.message}`);
    return { ok: true, editor: editorDefaults, notifications: notificationDefaults };
  });
