import type {
  PlannedAcquisitionAttempt,
  PriorAcquisitionAttempt,
} from "../security/acquisition-plan.js";
import type { TaskFailure } from "../domain/types.js";
import { supabase } from "../storage/client.js";

type AttemptRow = {
  id: string;
  source_tier: PriorAcquisitionAttempt["sourceTier"];
  strategy: PriorAcquisitionAttempt["strategy"] | null;
  egress_fingerprint: string | null;
  status: string;
};

export async function loadPriorAcquisitionAttempts(jobTaskId: string) {
  const { data, error } = await supabase
    .from("source_acquisition_attempts")
    .select("id,source_tier,strategy,egress_fingerprint,status")
    .eq("job_task_id", jobTaskId)
    .order("ordinal", { ascending: true });
  if (error) throw error;

  const rows = (data ?? []) as AttemptRow[];
  for (const row of rows) {
    if (["queued", "leased", "running", "awaiting_callback"].includes(row.status)) {
      const { error: finishError } = await supabase.rpc("finish_source_acquisition_attempt", {
        p_attempt_id: row.id,
        p_status: "superseded",
        p_error_code: "worker_interrupted",
        p_error_message: "The interrupted acquisition path was safely superseded.",
      });
      if (finishError) throw finishError;
      row.status = "superseded";
    }
  }
  return rows.map((row): PriorAcquisitionAttempt => ({
    sourceTier: row.source_tier,
    strategy: row.strategy ?? undefined,
    egressFingerprint: row.egress_fingerprint ?? undefined,
    status: ["succeeded", "cancelled", "superseded"].includes(row.status)
      ? (row.status as PriorAcquisitionAttempt["status"])
      : "failed",
  }));
}

export async function recordAcquisitionAttempt(
  jobTaskId: string,
  planned: PlannedAcquisitionAttempt,
  ordinal: number,
) {
  const idempotencyKey = [
    jobTaskId,
    ordinal,
    planned.sourceTier,
    planned.strategy ?? "none",
    planned.egressFingerprint ?? "none",
  ].join(":");
  const { data, error } = await supabase.rpc("record_source_acquisition_attempt", {
    p_job_task_id: jobTaskId,
    p_ordinal: ordinal,
    p_source_tier: planned.sourceTier,
    p_strategy: planned.strategy ?? "",
    p_pool_member_index: planned.poolMemberIndex ?? null,
    p_pool_member_id: planned.poolMemberId ?? "",
    p_egress_fingerprint: planned.egressFingerprint ?? "",
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as { id?: string } | null;
  if (!row?.id) throw new Error("Acquisition attempt persistence returned no identifier");
  return { id: row.id };
}

export async function finishAcquisitionAttempt(
  attemptId: string,
  status: "succeeded" | "failed" | "cancelled",
  failure?: TaskFailure,
) {
  const { error } = await supabase.rpc("finish_source_acquisition_attempt", {
    p_attempt_id: attemptId,
    p_status: status,
    p_error_code: failure?.code ?? null,
    p_error_message: failure?.message.slice(0, 2000) ?? null,
  });
  if (error) throw error;
}
