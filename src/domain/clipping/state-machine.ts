import type { ClipJobStatus, TaskStatus } from "./types";

const jobTransitions: Record<ClipJobStatus, readonly ClipJobStatus[]> = {
  draft: ["awaiting_source", "uploading", "queued", "cancelled"],
  awaiting_source: ["uploading", "queued", "cancelled", "expired"],
  awaiting_authorised_source: [
    "awaiting_local_relay",
    "queued",
    "uploading",
    "cancelled",
    "expired",
  ],
  awaiting_local_relay: ["awaiting_authorised_source", "queued", "cancelled", "expired"],
  uploading: ["queued", "failed", "cancelled"],
  queued: ["validating", "cancelled", "failed"],
  validating: ["creating_proxy", "extracting_audio", "failed", "cancelled"],
  creating_proxy: ["extracting_audio", "transcribing", "failed", "cancelled"],
  extracting_audio: ["transcribing", "failed", "cancelled"],
  transcribing: ["analysing", "planning", "failed", "cancelled"],
  analysing: ["planning", "failed", "cancelled"],
  planning: ["rendering_previews", "failed", "cancelled"],
  rendering_previews: ["ready", "partially_ready", "failed", "cancelled"],
  ready: ["exporting", "expiring", "cancelled"],
  partially_ready: ["rendering_previews", "exporting", "expiring", "cancelled"],
  exporting: ["ready", "partially_ready", "completed", "failed", "cancelled"],
  completed: ["exporting", "expiring"],
  failed: ["queued", "expiring"],
  cancelled: ["expiring"],
  expiring: ["expired"],
  expired: [],
};

const taskTransitions: Record<TaskStatus, readonly TaskStatus[]> = {
  pending: ["queued", "cancelled"],
  queued: ["leased", "cancelled"],
  leased: ["running", "queued", "cancelled"],
  running: ["succeeded", "failed", "retry_wait", "cancelled"],
  retry_wait: ["queued", "cancelled", "dead_lettered"],
  succeeded: [],
  failed: ["queued", "dead_lettered", "superseded"],
  cancelled: [],
  dead_lettered: ["queued", "superseded"],
  superseded: [],
};

export const canTransitionJob = (from: ClipJobStatus, to: ClipJobStatus) =>
  jobTransitions[from].includes(to);
export const canTransitionTask = (from: TaskStatus, to: TaskStatus) =>
  taskTransitions[from].includes(to);
