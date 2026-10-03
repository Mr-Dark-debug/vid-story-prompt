import { z } from "zod";
import { resolveWorkerLlm, type ResolvedLlm } from "../ai/credentials.js";
import { failureFromProviderError } from "../ai/failure.js";
import { socialCopySchema } from "../ai/schema.js";
import { TaskFailure, type AiRunTask } from "../domain/types.js";
import { supabase } from "../storage/client.js";
import { isAiProviderError } from "../vendor/ai/errors.js";
import { getAiProvider } from "../vendor/ai/providers.js";
import {
  buildClipCopyUserPrompt,
  CLIP_COPY_JSON_SCHEMA,
  CLIP_COPY_SCHEMA_NAME,
  CLIP_COPY_SYSTEM_PROMPT,
} from "../vendor/ai/prompts.js";
import type { TokenUsage } from "../vendor/ai/types.js";

export type AiRunOutcome = {
  output: Record<string, unknown>;
  providerId: string | null;
  modelId: string | null;
  credentialSource: string | null;
  usage: TokenUsage;
};

export type ClipCopySource = {
  clipId: string;
  candidateId: string;
  topic: string | null;
  selectionReason: string | null;
  transcriptExcerpt: string | null;
};

/** Persistence for regenerated clip copy; scoped to the run's workspace by the implementation. */
export interface ClipCopyStore {
  load(clipId: string, workspaceId: string): Promise<ClipCopySource | null>;
  save(source: ClipCopySource, workspaceId: string, title: string, socialCopy: unknown): Promise<void>;
}

export function createSupabaseClipCopyStore(): ClipCopyStore {
  return {
    async load(clipId, workspaceId) {
      const { data: clip, error } = await supabase
        .from("clips")
        .select("id,clip_job_id,clip_candidate_id,deleted_at")
        .eq("id", clipId)
        .maybeSingle();
      if (error) throw error;
      if (!clip || clip.deleted_at || !clip.clip_candidate_id) return null;
      // The clip must belong to a job in the run's own workspace.
      const { data: job } = await supabase
        .from("clip_jobs")
        .select("id")
        .eq("id", clip.clip_job_id)
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (!job) return null;
      const { data: candidate, error: candidateError } = await supabase
        .from("clip_candidates")
        .select("topic,selection_reason,transcript_excerpt")
        .eq("id", clip.clip_candidate_id)
        .maybeSingle();
      if (candidateError) throw candidateError;
      if (!candidate) return null;
      return {
        clipId,
        candidateId: clip.clip_candidate_id as string,
        topic: (candidate.topic as string | null) ?? null,
        selectionReason: (candidate.selection_reason as string | null) ?? null,
        transcriptExcerpt: (candidate.transcript_excerpt as string | null) ?? null,
      };
    },
    async save(source, _workspaceId, title, socialCopy) {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("clip_candidates")
        .update({ title, social_copy_json: socialCopy, updated_at: now })
        .eq("id", source.candidateId);
      if (error) throw error;
      const { error: clipError } = await supabase
        .from("clips")
        .update({ title, updated_at: now })
        .eq("id", source.clipId);
      if (clipError) throw clipError;
    },
  };
}

const clipCopyInput = z.object({ clipId: z.string().uuid() });
const clipCopyOutput = z.object({ title: z.string().trim().min(1).max(120), socialCopy: socialCopySchema });

export type AiRunDeps = {
  store?: ClipCopyStore;
  resolve?: typeof resolveWorkerLlm;
  signal?: AbortSignal;
};

async function socialCopy(run: AiRunTask, deps: AiRunDeps): Promise<AiRunOutcome> {
  const input = clipCopyInput.safeParse(run.input_json);
  if (!input.success) throw new TaskFailure("invalid_input", "This run has no clip to write copy for.", false);
  const store = deps.store ?? createSupabaseClipCopyStore();
  const source = await store.load(input.data.clipId, run.workspace_id);
  if (!source) throw new TaskFailure("clip_not_found", "That clip is no longer available.", false);

  const resolved: ResolvedLlm = await (deps.resolve ?? resolveWorkerLlm)({
    workspaceId: run.workspace_id,
    userId: run.user_id,
    purpose: "social_copy",
    explicit: run.credential_id && run.model_id ? { credentialId: run.credential_id, modelId: run.model_id } : null,
  });
  const llm = resolved.llm;
  if (!llm) {
    // Copy needs a model; there is no deterministic equivalent to fall back on.
    throw new TaskFailure(
      "no_model",
      resolved.resolution.skipped.length || resolved.decryptFailed
        ? "The selected key is not usable. Reconnect it in AI providers settings."
        : "Choose a model for social copy in AI providers settings.",
      false,
    );
  }
  if (deps.signal?.aborted) throw new TaskFailure("cancelled", "Copy generation was cancelled.", false);

  let completion;
  try {
    completion = await llm.complete({
      system: CLIP_COPY_SYSTEM_PROMPT,
      user: buildClipCopyUserPrompt({
        topic: source.topic,
        selectionReason: source.selectionReason,
        transcriptExcerpt: source.transcriptExcerpt,
      }),
      schemaName: CLIP_COPY_SCHEMA_NAME,
      schema: CLIP_COPY_JSON_SCHEMA as unknown as Record<string, unknown>,
      temperature: 0.55,
      signal: deps.signal,
    });
  } catch (error) {
    if (isAiProviderError(error)) {
      if (error.code === "aborted") throw new TaskFailure("cancelled", "Copy generation was cancelled.", false);
      if (error.invalidatesCredential) await llm.onRejected?.(error).catch(() => undefined);
      if (error.code === "invalid_response") {
        throw new TaskFailure("ai_invalid_response", "The model returned an unreadable answer. Try again.", true);
      }
      throw failureFromProviderError(error, getAiProvider(llm.providerId)?.label ?? llm.providerId);
    }
    throw error;
  }
  const parsed = clipCopyOutput.safeParse(completion.json);
  if (!parsed.success) {
    throw new TaskFailure("ai_invalid_output", "The model's answer did not match the expected format. Try again.", true);
  }
  // Last chance to honour a cancellation before anything is written.
  if (deps.signal?.aborted) throw new TaskFailure("cancelled", "Copy generation was cancelled.", false);
  await store.save(source, run.workspace_id, parsed.data.title, parsed.data.socialCopy);
  return {
    output: { clipId: source.clipId, title: parsed.data.title },
    providerId: llm.providerId,
    modelId: llm.modelId,
    credentialSource: llm.source,
    usage: completion.usage,
  };
}

export async function handleAiRun(run: AiRunTask, deps: AiRunDeps = {}): Promise<AiRunOutcome> {
  switch (run.purpose) {
    case "social_copy":
      return socialCopy(run, deps);
    default:
      throw new TaskFailure(
        "unsupported_purpose",
        `The worker cannot run "${run.purpose}" work in the background.`,
        false,
      );
  }
}
