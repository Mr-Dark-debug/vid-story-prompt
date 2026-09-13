import { z } from "zod";
import { selectedClipCandidateSchema } from "../ai/schema.js";
import { TaskFailure, type ClipTask, type TaskResult } from "../domain/types.js";
import { editManifestSchema } from "../media/manifest.js";
import { supabase } from "../storage/client.js";

const settingsSchema = z.object({
  mode: z.literal("manual_timestamp"),
  ranges: z
    .array(
      z.object({
        startSeconds: z.number().finite().nonnegative(),
        endSeconds: z.number().finite().positive(),
        label: z.string().trim().max(120).optional(),
      }),
    )
    .min(1)
    .max(50),
  captionsRequested: z.literal(false).default(false),
});

export function buildExactCutManifests(settings: unknown, actualDuration: number) {
  const parsed = settingsSchema.safeParse(settings);
  if (!parsed.success || !Number.isFinite(actualDuration) || actualDuration <= 0)
    throw new TaskFailure("invalid_clip_ranges", "The selected clip ranges are invalid.", false);
  return parsed.data.ranges.map((range, index) => {
    if (range.endSeconds <= range.startSeconds || range.endSeconds > actualDuration)
      throw new TaskFailure(
        "invalid_clip_ranges",
        "A selected range falls outside the acquired source.",
        false,
      );
    const candidate = selectedClipCandidateSchema.parse({
      ...range,
      origin: "manual_timestamp",
      title: range.label || `Clip ${index + 1}`,
    });
    return editManifestSchema.parse({
      version: 2,
      title: candidate.title,
      startSeconds: candidate.startSeconds,
      endSeconds: candidate.endSeconds,
      aspectRatio: "9:16",
      cropMode: "fit",
      focalPoint: { x: 0.5, y: 0.5 },
      safeArea: true,
      captions: {
        text: "",
        cues: [],
        fontPreset: "clean_sans",
        fontSize: 64,
        fontWeight: "bold",
        position: "bottom",
        alignment: "center",
        textColor: "#ffffff",
        highlightColor: "#ff9a66",
        backgroundColor: "#000000",
        backgroundOpacity: 0.5,
        strokeColor: "#101010",
        strokeWidth: 4,
        shadow: true,
        activeWord: false,
        keywordHighlight: [],
        animation: "none",
        profanityMask: false,
      },
      textOverlays: [],
      audio: { gainDb: 0, muted: false, fadeInSeconds: 0, fadeOutSeconds: 0, normalize: false },
    });
  });
}

export async function materializeExactCut(
  task: ClipTask,
  settings: unknown,
  actualDuration: number,
): Promise<TaskResult> {
  const manifests = buildExactCutManifests(settings, actualDuration);
  const { data, error } = await supabase.rpc("materialize_exact_cut", {
    p_task_id: task.id,
    p_worker_id: task.lease_owner,
    p_source_duration_seconds: actualDuration,
    p_manifests: manifests,
  });
  if (error) throw error;
  const clips = z
    .array(z.object({ clipId: z.string().uuid(), candidateId: z.string().uuid() }))
    .parse(data);
  return {
    output: { candidateCount: clips.length, origin: "manual_timestamp", plannerSkipped: true },
    jobStatus: "rendering_previews",
    message: `Prepared ${clips.length} exact cuts. Transcription and AI discovery were skipped.`,
    children: clips.map((clip) => ({
      taskType: "render_clip_preview",
      input: clip,
      dependencyGroup: "previews",
      idempotencyKey: `${task.clip_job_id}:preview:${clip.clipId}`,
    })),
  };
}
