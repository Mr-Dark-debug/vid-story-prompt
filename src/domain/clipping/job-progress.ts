export const displayStages = [
  { id: "awaiting_source", label: "Source import" },
  { id: "queued", label: "Queued" },
  { id: "validating", label: "Validating" },
  { id: "creating_proxy", label: "Creating proxy" },
  { id: "extracting_audio", label: "Extracting audio" },
  { id: "transcribing", label: "Transcribing" },
  { id: "analysing", label: "Analysing" },
  { id: "planning", label: "Planning" },
  { id: "rendering_previews", label: "Rendering previews" },
  { id: "ready", label: "Ready" },
] as const;

export type DisplayStageId = (typeof displayStages)[number]["id"];
export type DisplayStageState = "completed" | "active" | "retrying" | "failed" | "pending";

export type ProgressTask = {
  task_type: string;
  status: string;
};

const taskStage: Record<string, DisplayStageId> = {
  download_direct_source: "awaiting_source",
  download_youtube_source: "awaiting_source",
  validate_source: "validating",
  create_proxy: "creating_proxy",
  extract_audio: "extracting_audio",
  split_audio: "extracting_audio",
  transcribe_chunk: "transcribing",
  merge_transcript: "transcribing",
  detect_scenes: "analysing",
  generate_candidate_windows: "analysing",
  score_candidate_window: "analysing",
  merge_candidates: "planning",
  render_clip_preview: "rendering_previews",
};

function taskGroupState(tasks: ProgressTask[]): DisplayStageState {
  const current = tasks.filter((task) => task.status !== "superseded");
  if (current.some((task) => task.status === "failed" || task.status === "dead_lettered"))
    return "failed";
  if (current.some((task) => task.status === "retry_wait")) return "retrying";
  if (current.some((task) => task.status === "running" || task.status === "leased"))
    return "active";
  if (current.length > 0 && current.every((task) => task.status === "succeeded"))
    return "completed";
  return "pending";
}

export function deriveJobStages(
  job: { status: string },
  tasks: ProgressTask[],
): Array<(typeof displayStages)[number] & { state: DisplayStageState }> {
  const grouped = new Map<DisplayStageId, ProgressTask[]>();
  for (const task of tasks) {
    const stage = taskStage[task.task_type];
    if (!stage) continue;
    grouped.set(stage, [...(grouped.get(stage) ?? []), task]);
  }

  const activeJobStage = displayStages.some((stage) => stage.id === job.status)
    ? (job.status as DisplayStageId)
    : null;
  const hasStarted = tasks.some((task) => !["pending", "queued"].includes(task.status));
  const hasCompletedWork = tasks.some((task) => task.status === "succeeded");

  return displayStages.map((stage) => {
    if (
      stage.id === "awaiting_source" &&
      ["awaiting_authorised_source", "awaiting_local_relay"].includes(job.status)
    ) {
      return { ...stage, state: "retrying" };
    }
    if (stage.id === "queued") {
      if (job.status === "queued") return { ...stage, state: "active" };
      if (["failed", "cancelled", "expired"].includes(job.status) && !hasCompletedWork) {
        return { ...stage, state: "pending" };
      }
      return { ...stage, state: hasStarted ? "completed" : "pending" };
    }
    if (stage.id === "ready") {
      return {
        ...stage,
        state: ["ready", "partially_ready", "completed"].includes(job.status)
          ? "completed"
          : "pending",
      };
    }
    const group = grouped.get(stage.id) ?? [];
    const state = taskGroupState(group);
    if (state !== "pending") return { ...stage, state };
    if (activeJobStage === stage.id && !["failed", "cancelled", "expired"].includes(job.status))
      return { ...stage, state: "active" };
    return { ...stage, state: "pending" };
  });
}

export type JobStatusTone = "success" | "active" | "info" | "warning" | "danger" | "neutral";

export function getJobStatusPresentation(status: string): {
  label: string;
  tone: JobStatusTone;
  active: boolean;
} {
  if (["ready", "completed", "partially_ready"].includes(status))
    return {
      label:
        status === "partially_ready"
          ? "Partially ready"
          : status === "completed"
            ? "Completed"
            : "Ready",
      tone: "success",
      active: false,
    };
  if (["failed", "dead_lettered"].includes(status))
    return { label: "Failed", tone: "danger", active: false };
  if (["cancelled", "expired", "expiring"].includes(status))
    return {
      label: status === "cancelled" ? "Cancelled" : "Expired",
      tone: "neutral",
      active: false,
    };
  if (status === "retry_wait") return { label: "Retrying", tone: "warning", active: true };
  if (status === "awaiting_local_relay")
    return { label: "Waiting for helper", tone: "warning", active: true };
  if (
    ["draft", "awaiting_source", "awaiting_authorised_source", "uploading", "queued"].includes(
      status,
    )
  )
    return {
      label:
        status === "awaiting_authorised_source"
          ? "Source needed"
          : status === "awaiting_source"
            ? "Awaiting source"
            : status === "uploading"
              ? "Uploading"
              : status === "queued"
                ? "Queued"
                : "Draft",
      tone: "info",
      active: status === "uploading" || status === "queued",
    };
  return {
    label: status.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()),
    tone: "active",
    active: true,
  };
}
