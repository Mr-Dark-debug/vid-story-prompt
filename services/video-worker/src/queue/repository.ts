import { env } from "../config/env.js";
import type { ClipTask, ConnectorTask, ConnectorTaskResult, TaskResult } from "../domain/types.js";
import { supabase } from "../storage/client.js";

function first<T>(value: unknown): T | null {
  return Array.isArray(value) ? ((value[0] as T | undefined) ?? null) : (value as T | null);
}
export async function claimTask() {
  const { data, error } = await supabase.rpc("claim_clip_task", {
    p_worker_id: env.WORKER_ID,
    p_lease_seconds: env.TASK_VISIBILITY_TIMEOUT_SECONDS,
  });
  if (error) throw error;
  return first<ClipTask>(data);
}
export async function startTask(id: string) {
  const { data, error } = await supabase.rpc("start_clip_task", {
    p_task_id: id,
    p_worker_id: env.WORKER_ID,
  });
  if (error || !data) throw error ?? new Error("Task lease was lost before start");
}
export async function heartbeat(id: string, current?: number, total?: number) {
  const { error } = await supabase.rpc("heartbeat_clip_task", {
    p_task_id: id,
    p_worker_id: env.WORKER_ID,
    p_lease_seconds: env.TASK_VISIBILITY_TIMEOUT_SECONDS,
    p_current: current ?? null,
    p_total: total ?? null,
  });
  if (error) throw error;
}
export async function completeTask(id: string, result: TaskResult) {
  const { data, error } = await supabase.rpc("complete_clip_task", {
    p_task_id: id,
    p_worker_id: env.WORKER_ID,
    p_output: result.output ?? {},
    p_children: result.children ?? [],
    p_job_status: result.jobStatus ?? null,
    p_message: result.message ?? "Task completed",
  });
  if (error || !data) throw error ?? new Error("Task completion lease was rejected");
}
export async function failTask(
  task: ClipTask,
  code: string,
  message: string,
  retryable: boolean,
  nextAttemptAt: string | null,
) {
  const { error } = await supabase.rpc("fail_clip_task", {
    p_task_id: task.id,
    p_worker_id: env.WORKER_ID,
    p_error_code: code,
    p_error_message: message,
    p_retryable: retryable,
    p_next_attempt_at: nextAttemptAt,
  });
  if (error) throw error;
}

export async function claimConnectorTask() {
  const { data, error } = await supabase.rpc("claim_connector_task", {
    p_worker_id: env.WORKER_ID,
    p_lease_seconds: env.TASK_VISIBILITY_TIMEOUT_SECONDS,
  });
  if (error) throw error;
  return first<ConnectorTask>(data);
}
export async function startConnectorTask(id: string) {
  const { data, error } = await supabase.rpc("start_connector_task", {
    p_task_id: id,
    p_worker_id: env.WORKER_ID,
  });
  if (error || !data) throw error ?? new Error("Connector task lease was lost before start");
}
export async function heartbeatConnectorTask(id: string, current?: number, total?: number) {
  const { error } = await supabase.rpc("heartbeat_connector_task", {
    p_task_id: id,
    p_worker_id: env.WORKER_ID,
    p_lease_seconds: env.TASK_VISIBILITY_TIMEOUT_SECONDS,
    p_current: current ?? null,
    p_total: total ?? null,
  });
  if (error) throw error;
}
export async function completeConnectorTask(id: string, result: ConnectorTaskResult) {
  const { data, error } = await supabase.rpc("complete_connector_task", {
    p_task_id: id,
    p_worker_id: env.WORKER_ID,
    p_output: result.output ?? {},
  });
  if (error || !data) throw error ?? new Error("Connector task completion lease was rejected");
}
export async function failConnectorTask(
  task: ConnectorTask,
  code: string,
  message: string,
  retryable: boolean,
  nextAttemptAt: string | null,
) {
  const { error } = await supabase.rpc("fail_connector_task", {
    p_task_id: task.id,
    p_worker_id: env.WORKER_ID,
    p_error_code: code,
    p_error_message: message,
    p_retryable: retryable,
    p_next_attempt_at: nextAttemptAt,
  });
  if (error) throw error;
}
