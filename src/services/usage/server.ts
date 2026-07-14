import { createServerFn } from "@tanstack/react-start";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentSession } from "@/services/auth/server";
import { getPlanEntitlement } from "@/domain/clipping/entitlements";

export const getUsageOverview = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getCurrentSession();
  if (!session?.workspaceId) throw new Error("Your workspace session expired.");
  const supabase = getSupabaseServerClient();
  const [{ data: period }, { data: ledger }, { data: assets }, { count: exportCount }] =
    await Promise.all([
      supabase
        .from("usage_periods")
        .select("*")
        .eq("workspace_id", session.workspaceId)
        .order("period_start", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("usage_ledger")
        .select("id,category,amount,unit,direction,state,description,created_at")
        .eq("workspace_id", session.workspaceId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("media_assets")
        .select("size_bytes")
        .eq("workspace_id", session.workspaceId)
        .is("deleted_at", null),
      supabase
        .from("exports")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", session.workspaceId),
    ]);
  const plan = getPlanEntitlement(
    session.plan === "creator" || session.plan === "pro" ? session.plan : "free",
  );
  return {
    period: period ?? {
      source_seconds_limit: plan.monthlySourceSeconds,
      source_seconds_reserved: 0,
      source_seconds_committed: 0,
      generation_credits_limit: 0,
      generation_credits_reserved: 0,
      generation_credits_committed: 0,
      period_start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
      period_end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
    },
    ledger: ledger ?? [],
    storageBytes: (assets ?? []).reduce((sum, asset) => sum + Number(asset.size_bytes ?? 0), 0),
    exportCount: exportCount ?? 0,
    plan: session.plan,
  };
});
