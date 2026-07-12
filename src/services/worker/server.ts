import { getServerEnv } from "@/config/env.server";

export type WorkerWakeResult = "accepted" | "failed" | "not_configured";

export async function wakeVideoWorker(): Promise<WorkerWakeResult> {
  const { VIDEO_WORKER_URL, WORKER_WAKE_SECRET } = getServerEnv();
  if (!VIDEO_WORKER_URL || !WORKER_WAKE_SECRET) return "not_configured";

  try {
    const response = await fetch(new URL("/wake", VIDEO_WORKER_URL), {
      headers: { authorization: `Bearer ${WORKER_WAKE_SECRET}` },
      method: "POST",
      signal: AbortSignal.timeout(8_000),
    });
    return response.status === 202 ? "accepted" : "failed";
  } catch {
    return "failed";
  }
}
