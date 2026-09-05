import { Check, Clock3, LoaderCircle, AlertTriangle } from "lucide-react";
import { deriveJobStages, type ProgressTask } from "@/domain/clipping/job-progress";
import { cn } from "@/lib/utils";

const phases = [
  {
    label: "Import",
    detail: "Receive and check your source",
    stages: ["awaiting_source", "queued", "validating"],
  },
  {
    label: "Understand",
    detail: "Prepare audio and find moments",
    stages: ["creating_proxy", "extracting_audio", "transcribing", "analysing", "planning"],
  },
  { label: "Create", detail: "Render your clip previews", stages: ["rendering_previews"] },
  { label: "Ready", detail: "Review, edit and export", stages: ["ready"] },
];

export function ProcessingOverview({
  job,
  tasks,
}: {
  job: { status: string; completed_clip_count: number; requested_clip_count: number };
  tasks: ProgressTask[];
}) {
  const stages = deriveJobStages(job, tasks);
  const ready = ["ready", "partially_ready", "completed", "exporting"].includes(job.status);
  const stopped = ["failed", "cancelled", "expired"].includes(job.status);
  const waiting = ["awaiting_authorised_source", "awaiting_local_relay"].includes(job.status);
  const current =
    stages.find((stage) => stage.state === "active") ??
    stages.find((stage) => stage.state === "retrying") ??
    stages.find((stage) => stage.state === "failed");
  const transcription = tasks.filter(
    (task) => task.task_type === "transcribe_chunk" && task.status !== "superseded",
  );
  const heading = ready
    ? "Your clips are ready to review"
    : waiting
      ? "Your source needs attention"
      : stopped
        ? job.status === "failed"
          ? "Processing needs attention"
          : "Processing has stopped"
        : (current?.label ?? "Waiting for a worker");
  return (
    <div className="mt-5">
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="rounded-xl bg-surface-sunken p-4 sm:p-5"
      >
        <p className="text-lg font-semibold text-ink">{heading}</p>
        <p className="mt-1 text-sm leading-6 text-ink-soft">
          {ready
            ? `${job.completed_clip_count} of ${job.requested_clip_count} clip previews available below.`
            : waiting || stopped
              ? "Completed work is saved. Check the message below for the next step."
              : current?.state === "retrying"
                ? "A temporary interruption occurred. Your worker will retry automatically."
                : transcription.length && current?.id === "transcribing"
                  ? `${transcription.filter((task) => task.status === "succeeded").length} of ${transcription.length} audio sections transcribed.`
                  : "You can leave this page. Processing continues and your clips appear as they finish."}
        </p>
      </div>
      <ol aria-label="Clipping progress" className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {phases.map((phase, index) => {
          const group = stages.filter((stage) => phase.stages.includes(stage.id));
          const failed = group.some((stage) => stage.state === "failed");
          const active =
            !ready &&
            !stopped &&
            group.some((stage) => ["active", "retrying"].includes(stage.state));
          const downstreamStarted = phases
            .slice(index + 1)
            .some((later) =>
              stages.some(
                (stage) =>
                  later.stages.includes(stage.id) &&
                  ["active", "completed", "retrying"].includes(stage.state),
              ),
            );
          const complete =
            ready ||
            (!failed && (downstreamStarted || group.every((stage) => stage.state === "completed")));
          const label = complete
            ? "Complete"
            : failed
              ? "Needs attention"
              : active
                ? "In progress"
                : "Upcoming";
          const Icon = complete ? Check : failed ? AlertTriangle : active ? LoaderCircle : Clock3;
          return (
            <li
              key={phase.label}
              aria-current={active ? "step" : undefined}
              className={cn(
                "min-w-0 rounded-xl border p-3 sm:p-4",
                active ? "border-ember bg-ember/5" : "border-line",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-ink-mute">0{index + 1}</span>
                <Icon
                  aria-hidden
                  className={cn(
                    "h-4 w-4",
                    complete ? "text-success" : failed ? "text-danger" : "text-ink-soft",
                    active && "animate-spin motion-reduce:animate-none",
                  )}
                />
              </div>
              <p className="mt-3 text-sm font-semibold text-ink">{phase.label}</p>
              <p className="mt-1 text-xs leading-5 text-ink-soft">{label}</p>
              <p className="mt-1 hidden text-xs leading-5 text-ink-mute sm:block">{phase.detail}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
