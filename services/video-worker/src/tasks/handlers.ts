import { randomUUID } from "node:crypto";
import { mkdir, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { execa } from "execa";
import { z } from "zod";
import { planClips } from "../ai/planner.js";
import { selectDiverseCandidates } from "../ai/selection.js";
import { env } from "../config/env.js";
import { TaskFailure, type ClipTask, type TaskResult } from "../domain/types.js";
import { createProxy, extractSpeechAudio, renderClip } from "../media/ffmpeg.js";
import { probeMedia } from "../media/probe.js";
import { downloadDirectMedia } from "../security/direct-download.js";
import { getHealthyWarpMembers } from "../security/acquisition-runtime.js";
import { cobaltClient } from "../security/cobalt-download.js";
import { acquireYouTubeSource } from "../security/youtube-acquisition.js";
import {
  downloadYouTubeMedia,
  readYouTubeSourceSection,
  selectYouTubeDownloadStrategy,
} from "../security/youtube-download.js";
import { scanLocalFile } from "../security/virus-scan.js";
import type { YouTubeProxySelection } from "../security/youtube-proxy.js";
import { downloadAsset, supabase, uploadAsset } from "../storage/client.js";
import { mergeTranscriptChunks } from "../transcription/merge.js";
import { transcribeWithFallback } from "../transcription/providers.js";
import {
  downloadJobSource,
  getAsset,
  getJob,
  immutablePath,
  sha256,
  withTaskDirectory,
} from "./context.js";
import { renderExport } from "./export.js";
import { deleteExpiredAssets } from "./cleanup.js";
import { renderBatchExport } from "./batch-export.js";
import { publishYouTubeVideo } from "./youtube-publish.js";
import {
  finishAcquisitionAttempt,
  loadPriorAcquisitionAttempts,
  recordAcquisitionAttempt,
} from "./source-acquisition-repository.js";

const uuid = z.string().uuid();
async function insertAsset(
  job: Awaited<ReturnType<typeof getJob>>,
  input: {
    id?: string;
    bucket: string;
    path: string;
    name: string;
    mime: string;
    size: number;
    checksum: string;
    status?: string;
    metadata?: Record<string, unknown>;
  },
) {
  const id = input.id ?? randomUUID();
  const { error } = await supabase.from("media_assets").insert({
    id,
    workspace_id: job.workspace_id,
    user_id: job.user_id,
    source_type: job.source_type,
    storage_bucket: input.bucket,
    storage_path: input.path,
    display_name: input.name,
    mime_type: input.mime,
    size_bytes: input.size,
    checksum_sha256: input.checksum,
    status: input.status ?? "ready",
    metadata_json: input.metadata ?? {},
  });
  if (error) throw error;
  return id;
}

async function validateSource(task: ClipTask): Promise<TaskResult> {
  return withTaskDirectory(task, async (directory) => {
    const { job, asset, target } = await downloadJobSource(task.clip_job_id, directory);
    const virusScan = await scanLocalFile(target);
    const info = await probeMedia(target);
    if (!info.hasAudio)
      throw new TaskFailure("missing_audio", "Speech clipping requires an audio stream.", false);
    const expectedDuration = Number(
      task.input_json.expectedDurationSeconds ?? job.source_duration_seconds,
    );
    const durationTolerance = Math.max(5, expectedDuration * 0.05);
    const durationDelta = Math.abs(info.durationSeconds - expectedDuration);
    const authorisedRecovery = task.input_json.authorisedSourceRecovery === true;
    const confirmedMismatch = task.input_json.confirmedMismatch === true;
    if (info.durationSeconds > expectedDuration + durationTolerance)
      throw new TaskFailure(
        "duration_limit",
        `The attached file is ${Math.round(info.durationSeconds)} seconds, longer than the ${Math.round(expectedDuration)} seconds reserved for this job. Choose the matching original file.`,
        false,
      );
    if (authorisedRecovery && durationDelta > durationTolerance && !confirmedMismatch)
      throw new TaskFailure(
        "source_match_confirmation_required",
        `The attached file is ${Math.round(info.durationSeconds)} seconds, but this job expects about ${Math.round(expectedDuration)} seconds. Confirm this shorter file before continuing.`,
        false,
      );
    const checksum = await sha256(target);
    const { error } = await supabase
      .from("media_assets")
      .update({
        checksum_sha256: checksum,
        duration_seconds: info.durationSeconds,
        width: info.width,
        height: info.height,
        frame_rate: info.frameRate
          ? Number(info.frameRate.split("/")[0]) / Number(info.frameRate.split("/")[1] || 1)
          : null,
        video_codec: info.videoCodec,
        audio_codec: info.audioCodec,
        has_audio: info.hasAudio,
        status: "ready",
        metadata_json: { ...info, virusScan },
        updated_at: new Date().toISOString(),
      })
      .eq("id", asset.id);
    if (error) throw error;
    if (authorisedRecovery) {
      const confidence = durationDelta <= Math.max(2, expectedDuration * 0.01) ? 0.99 : 0.85;
      const { error: matchError } = await supabase
        .from("clip_jobs")
        .update({
          source_match_json: {
            status: confirmedMismatch ? "user_confirmed" : "verified",
            expectedDurationSeconds: expectedDuration,
            assetDurationSeconds: info.durationSeconds,
            durationDeltaSeconds: durationDelta,
            confidence,
            reason: "Worker-verified FFprobe duration and playable streams",
            confirmedMismatch,
            checksum,
            verifiedAt: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      if (matchError) throw matchError;
    }
    const { error: usageError } = await supabase.rpc("commit_source_usage", { p_job_id: job.id });
    if (usageError) throw usageError;
    return {
      output: { checksum, ...info },
      jobStatus: "creating_proxy",
      message: authorisedRecovery
        ? "Authorised replacement source matched and validated with FFprobe."
        : "Source validated with FFprobe.",
      children: [
        { taskType: "create_proxy", input: {}, idempotencyKey: `${job.id}:proxy` },
        { taskType: "extract_audio", input: {}, idempotencyKey: `${job.id}:audio` },
        { taskType: "detect_scenes", input: {}, idempotencyKey: `${job.id}:scenes` },
      ],
    };
  });
}

async function downloadDirect(task: ClipTask): Promise<TaskResult> {
  return withTaskDirectory(task, async (directory) => {
    const job = await getJob(task.clip_job_id);
    const url = z.string().url().parse(task.input_json.url);
    const target = join(directory, "direct-source");
    const downloaded = await downloadDirectMedia(url, target);
    const virusScan = await scanLocalFile(target);
    const info = await probeMedia(target);
    if (!info.hasAudio)
      throw new TaskFailure("missing_audio", "Speech clipping requires an audio stream.", false);
    const checksum = await sha256(target);
    const path = immutablePath(job, "source", "bin");
    await uploadAsset("source-media", path, target, "application/octet-stream");
    const assetId = await insertAsset(job, {
      bucket: "source-media",
      path,
      name: job.source_title ?? "Direct source",
      mime: "application/octet-stream",
      size: (await stat(target)).size,
      checksum,
      metadata: { ...info, virusScan, finalUrlOrigin: new URL(downloaded.finalUrl).origin },
    });
    const { error } = await supabase
      .from("clip_jobs")
      .update({
        source_asset_id: assetId,
        status: "validating",
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    if (error) throw error;
    return {
      output: { assetId, checksum, bytes: downloaded.bytes },
      jobStatus: "validating",
      message: "Owner-controlled media downloaded and isolated.",
      children: [
        {
          taskType: "validate_source",
          input:
            task.input_json.authorisedSourceRecovery === true
              ? {
                  authorisedSourceRecovery: true,
                  expectedDurationSeconds: job.source_duration_seconds,
                  confirmedMismatch: false,
                  connectorId: "direct_url",
                }
              : {},
          idempotencyKey:
            task.input_json.authorisedSourceRecovery === true
              ? `${job.id}:validate-authorised-direct:${task.id}`
              : `${job.id}:validate-direct`,
        },
      ],
    };
  });
}

async function assertYouTubeAcquisitionAllowed(job: Awaited<ReturnType<typeof getJob>>) {
  if (!["youtube_metadata", "youtube_connected_channel"].includes(job.source_type)) {
    throw new TaskFailure(
      "invalid_source_type",
      "This job is not eligible for YouTube acquisition.",
      false,
    );
  }
  const [{ data: attestation, error: attestationError }, { data: profile, error: profileError }] =
    await Promise.all([
      supabase.from("rights_attestations").select("id").eq("clip_job_id", job.id).maybeSingle(),
      supabase.from("profiles").select("plan_key").eq("id", job.user_id).maybeSingle(),
    ]);
  if (attestationError || !attestation) {
    throw new TaskFailure(
      "rights_attestation_required",
      "YouTube acquisition requires a recorded rights attestation.",
      false,
    );
  }
  if (profileError || !profile?.plan_key) {
    throw new TaskFailure(
      "plan_unavailable",
      "The workspace plan could not be verified for YouTube acquisition.",
      true,
    );
  }
  const { data: plan, error: planError } = await supabase
    .from("plans")
    .select("active,max_source_seconds_per_job")
    .eq("key", profile.plan_key)
    .maybeSingle();
  if (planError) {
    throw new TaskFailure(
      "plan_unavailable",
      "The workspace plan could not be verified for YouTube acquisition.",
      true,
    );
  }
  if (
    !plan?.active ||
    Number(job.source_duration_seconds) <= 0 ||
    Number(job.source_duration_seconds) > Number(plan.max_source_seconds_per_job)
  ) {
    throw new TaskFailure(
      "plan_limit_exceeded",
      "This YouTube source exceeds the workspace plan limits.",
      false,
    );
  }
}

async function attachYouTubeAsset(
  job: Awaited<ReturnType<typeof getJob>>,
  task: ClipTask,
  assetId: string,
  videoId: string,
) {
  const { data: updatedJob, error: jobError } = await supabase
    .from("clip_jobs")
    .update({
      source_asset_id: assetId,
      status: "validating",
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id)
    .not("status", "in", '("cancelled","expiring","expired")')
    .select("id")
    .maybeSingle();
  if (jobError) throw jobError;
  if (!updatedJob) {
    throw new TaskFailure("cancelled", "The YouTube acquisition job was cancelled.", false);
  }
  const { error: attachmentError } = await supabase.from("source_attachments").upsert({
    id: task.id,
    clip_job_id: job.id,
    connector_id: "youtube",
    connector_import_id: null,
    media_asset_id: assetId,
    youtube_video_id: videoId,
    relationship: "primary",
    match_confidence: 1,
    match_reason: "Rights-attested server acquisition",
  });
  if (attachmentError) throw attachmentError;
}

async function downloadYouTube(task: ClipTask, signal?: AbortSignal): Promise<TaskResult> {
  return withTaskDirectory(task, async (directory) => {
    const job = await getJob(task.clip_job_id);
    const videoId = z
      .string()
      .regex(/^[A-Za-z0-9_-]{11}$/)
      .parse(task.input_json.videoId);
    await assertYouTubeAcquisitionAllowed(job);

    if (job.source_asset_id) {
      await attachYouTubeAsset(job, task, job.source_asset_id, videoId);
      return {
        output: { assetId: job.source_asset_id, recovered: true },
        jobStatus: "validating",
        message: "Existing YouTube source acquisition recovered safely.",
        children: [
          { taskType: "validate_source", input: {}, idempotencyKey: `${job.id}:validate-yt` },
        ],
      };
    }

    const { data: existingAsset, error: existingAssetError } = await supabase
      .from("media_assets")
      .select("id")
      .eq("id", task.id)
      .maybeSingle();
    if (existingAssetError) throw existingAssetError;
    if (existingAsset) {
      await attachYouTubeAsset(job, task, existingAsset.id, videoId);
      return {
        output: { assetId: existingAsset.id, recovered: true },
        jobStatus: "validating",
        message: "Interrupted YouTube source acquisition recovered safely.",
        children: [
          { taskType: "validate_source", input: {}, idempotencyKey: `${job.id}:validate-yt` },
        ],
      };
    }

    const cancellation = new AbortController();
    const downloadSignal = signal
      ? AbortSignal.any([signal, cancellation.signal])
      : cancellation.signal;
    const cancellationPoll = setInterval(() => {
      void supabase
        .from("clip_jobs")
        .select("status")
        .eq("id", job.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data && ["cancelled", "expiring", "expired"].includes(data.status)) {
            cancellation.abort();
          }
        });
    }, 2_000);
    let downloaded: Awaited<ReturnType<typeof acquireYouTubeSource>>;
    try {
      const priorAttempts = await loadPriorAcquisitionAttempts(task.id);
      const section = readYouTubeSourceSection(task.input_json);
      downloaded = await acquireYouTubeSource({
        cancelled: () => cancellation.signal.aborted,
        cobaltEnabled: Boolean(env.COBALT_API_URL),
        downloadCobalt: async () => {
          const attemptDirectory = join(
            directory,
            `acquisition-cobalt-${priorAttempts.length + 1}`,
          );
          await mkdir(attemptDirectory, { recursive: true });
          return cobaltClient.download({
            apiKey: env.COBALT_API_KEY,
            apiUrl: env.COBALT_API_URL!,
            directory: attemptDirectory,
            maximumDurationSeconds: Number(job.source_duration_seconds),
            section,
            signal: downloadSignal,
            timeoutMs: env.COBALT_REQUEST_TIMEOUT_MS,
            videoId,
          });
        },
        downloadYtdlp: async (planned) => {
          const attemptDirectory = join(
            directory,
            `acquisition-${planned.sourceTier}-${planned.poolMemberIndex ?? "single"}-${planned.strategy}`,
          );
          await mkdir(attemptDirectory, { recursive: true });
          const proxy: YouTubeProxySelection =
            planned.sourceTier === "operator_proxy"
              ? { tier: "operator", url: planned.proxyUrl }
              : planned.sourceTier === "warp"
                ? { tier: "warp", url: planned.proxyUrl }
                : { tier: "direct" };
          return downloadYouTubeMedia(
            videoId,
            attemptDirectory,
            Number(job.source_duration_seconds),
            downloadSignal,
            planned.strategy ??
              selectYouTubeDownloadStrategy(task.attempt, Boolean(env.YTDLP_POT_PROVIDER_URL)),
            { proxy, section },
          );
        },
        finishAttempt: finishAcquisitionAttempt,
        operatorProxyUrl: env.YTDLP_PROXY_URL,
        potProviderConfigured: Boolean(env.YTDLP_POT_PROVIDER_URL),
        previous: priorAttempts,
        production: process.env.NODE_ENV === "production",
        recordAttempt: (planned, ordinal) => recordAcquisitionAttempt(task.id, planned, ordinal),
        warpMembers: getHealthyWarpMembers(),
      });
    } catch (error) {
      if (cancellation.signal.aborted) {
        throw new TaskFailure("cancelled", "The YouTube acquisition job was cancelled.", false);
      }
      throw error;
    } finally {
      clearInterval(cancellationPoll);
    }
    const virusScan = await scanLocalFile(downloaded.filename);
    const info = await probeMedia(downloaded.filename);
    if (!info.hasAudio)
      throw new TaskFailure("missing_audio", "Speech clipping requires an audio stream.", false);
    const checksum = await sha256(downloaded.filename);
    const path = `${job.workspace_id}/${job.user_id}/${job.id}/source/${task.id}.${downloaded.format}`;
    await uploadAsset("source-media", path, downloaded.filename, "application/octet-stream");
    const assetId = await insertAsset(job, {
      id: task.id,
      bucket: "source-media",
      path,
      name: job.source_title ?? "YouTube source",
      mime: "application/octet-stream",
      size: downloaded.bytes,
      checksum,
      metadata: {
        ...info,
        virusScan,
        youtubeVideoId: videoId,
        format: downloaded.format,
        sourceTier: downloaded.sourceTier,
        poolMemberIndex: downloaded.poolMemberIndex,
      },
    });
    await attachYouTubeAsset(job, task, assetId, videoId);
    return {
      output: {
        assetId,
        checksum,
        bytes: downloaded.bytes,
        format: downloaded.format,
        proxyTier: downloaded.proxyTier,
        sourceTier: downloaded.sourceTier,
        poolMemberIndex: downloaded.poolMemberIndex,
        sectionApplied: downloaded.sectionApplied,
      },
      jobStatus: "validating",
      message: `YouTube media acquired through ${downloaded.sourceTier === "cobalt" ? "the optional source adapter" : downloaded.proxyTier === "direct" ? "direct egress" : "protected egress"} and isolated.`,
      children: [
        { taskType: "validate_source", input: {}, idempotencyKey: `${job.id}:validate-yt` },
      ],
    };
  });
}

async function proxy(task: ClipTask): Promise<TaskResult> {
  return withTaskDirectory(task, async (directory) => {
    const { job, target } = await downloadJobSource(task.clip_job_id, directory);
    const output = join(directory, "proxy.mp4");
    await createProxy(target, output);
    const path = immutablePath(job, "proxy", "mp4");
    await uploadAsset("source-proxies", path, output, "video/mp4");
    const checksum = await sha256(output);
    const assetId = await insertAsset(job, {
      bucket: "source-proxies",
      path,
      name: "Source proxy",
      mime: "video/mp4",
      size: (await stat(output)).size,
      checksum,
    });
    return { output: { assetId, path }, message: "Editing proxy created." };
  });
}

async function audio(task: ClipTask): Promise<TaskResult> {
  return withTaskDirectory(task, async (directory) => {
    const { job, target } = await downloadJobSource(task.clip_job_id, directory);
    const output = join(directory, "speech.flac");
    await extractSpeechAudio(target, output);
    const path = immutablePath(job, "audio", "flac");
    await uploadAsset("audio-artifacts", path, output, "audio/flac");
    const checksum = await sha256(output);
    const assetId = await insertAsset(job, {
      bucket: "audio-artifacts",
      path,
      name: "Speech audio",
      mime: "audio/flac",
      size: (await stat(output)).size,
      checksum,
    });
    return {
      output: { assetId, path },
      jobStatus: "transcribing",
      message: "Speech audio extracted as mono 16 kHz FLAC.",
      children: [
        { taskType: "split_audio", input: { assetId }, idempotencyKey: `${job.id}:split-audio` },
      ],
    };
  });
}

async function splitAudio(task: ClipTask): Promise<TaskResult> {
  return withTaskDirectory(task, async (directory) => {
    const job = await getJob(task.clip_job_id);
    const asset = await getAsset(uuid.parse(task.input_json.assetId));
    if (!asset.storage_bucket || !asset.storage_path)
      throw new TaskFailure("missing_audio", "Audio artifact is missing.", false);
    const source = join(directory, "audio.flac");
    await downloadAsset(asset.storage_bucket, asset.storage_path, source);
    const pattern = join(directory, "chunk-%03d.flac");
    await execa(
      env.FFMPEG_PATH,
      [
        "-hide_banner",
        "-nostdin",
        "-y",
        "-i",
        source,
        "-f",
        "segment",
        "-segment_time",
        "600",
        "-segment_time_delta",
        "2",
        "-reset_timestamps",
        "1",
        "-c",
        "copy",
        pattern,
      ],
      { timeout: 30 * 60_000 },
    );
    const files = (await readdir(directory)).filter((name) => name.startsWith("chunk-")).sort();
    const children = [];
    for (let index = 0; index < files.length; index++) {
      const file = join(directory, files[index]);
      const path = immutablePath(job, "audio-chunks", "flac");
      await uploadAsset("audio-artifacts", path, file, "audio/flac");
      const chunkId = await insertAsset(job, {
        bucket: "audio-artifacts",
        path,
        name: `Audio chunk ${index + 1}`,
        mime: "audio/flac",
        size: (await stat(file)).size,
        checksum: await sha256(file),
        metadata: { sequence: index, offsetSeconds: index * 600 },
      });
      children.push({
        taskType: "transcribe_chunk",
        input: { assetId: chunkId, sequence: index, offsetSeconds: index * 600 },
        dependencyGroup: "transcription",
        idempotencyKey: `${job.id}:transcribe:${index}`,
      });
    }
    children.push({
      taskType: "merge_transcript",
      input: { expectedChunks: files.length },
      dependencyGroup: "transcription-merge",
      idempotencyKey: `${job.id}:merge-transcript`,
    });
    return {
      output: { chunks: files.length },
      message: `Created ${files.length} bounded transcription chunks.`,
      children,
    };
  });
}

async function transcribe(task: ClipTask): Promise<TaskResult> {
  return withTaskDirectory(task, async (directory) => {
    const asset = await getAsset(uuid.parse(task.input_json.assetId));
    if (!asset.storage_bucket || !asset.storage_path)
      throw new TaskFailure("missing_audio", "Transcription chunk is missing.", false);
    const file = join(directory, "chunk.flac");
    await downloadAsset(asset.storage_bucket, asset.storage_path, file);
    const result = await transcribeWithFallback(file);
    return {
      output: {
        ...result,
        sequence: Number(task.input_json.sequence ?? 0),
        offsetSeconds: Number(task.input_json.offsetSeconds ?? 0),
      },
      message: `Chunk transcribed with ${result.provider}.`,
    };
  });
}

async function mergeTranscript(task: ClipTask): Promise<TaskResult> {
  const job = await getJob(task.clip_job_id);
  const { data, error } = await supabase
    .from("job_tasks")
    .select("output_json")
    .eq("clip_job_id", job.id)
    .eq("task_type", "transcribe_chunk")
    .eq("status", "succeeded");
  if (error) throw error;
  const chunks = (data ?? []).map(
    (row) =>
      row.output_json as {
        offsetSeconds: number;
        text: string;
        words: { word: string; start: number; end: number }[];
      },
  );
  if (!chunks.length)
    throw new TaskFailure(
      "transcript_incomplete",
      "No successful transcript chunks were available.",
      true,
    );
  const merged = mergeTranscriptChunks(chunks);
  const { data: transcript, error: insertError } = await supabase
    .from("transcripts")
    .insert({
      clip_job_id: job.id,
      media_asset_id: job.source_asset_id,
      language: job.source_language,
      provider: "merged",
      model: "provider-neutral-v1",
      duration_seconds: job.source_duration_seconds,
      text: merged.text,
      status: "ready",
    })
    .select("id")
    .single();
  if (insertError) throw insertError;
  const segments = merged.words.map((word, index) => ({
    transcript_id: transcript.id,
    sequence: index,
    start_seconds: word.start,
    end_seconds: word.end,
    text: word.word,
    words_json: [word],
  }));
  if (segments.length) {
    const { error: segmentError } = await supabase.from("transcript_segments").insert(segments);
    if (segmentError) throw segmentError;
  }
  return {
    output: { transcriptId: transcript.id, wordCount: merged.words.length },
    jobStatus: "planning",
    message: "Transcript chunks merged with overlap deduplication.",
    children: [
      {
        taskType: "generate_candidate_windows",
        input: { transcriptId: transcript.id },
        idempotencyKey: `${job.id}:plan`,
      },
    ],
  };
}

async function plan(task: ClipTask): Promise<TaskResult> {
  const job = await getJob(task.clip_job_id);
  const { data: transcript, error } = await supabase
    .from("transcripts")
    .select("*")
    .eq("id", uuid.parse(task.input_json.transcriptId))
    .single();
  if (error) throw error;
  const settings = job.settings_json as Record<string, unknown>;
  const candidates = selectDiverseCandidates(
    await planClips({
      transcript: transcript.text,
      durationSeconds: Number(job.source_duration_seconds),
      requestedClips: job.requested_clip_count,
      instruction: String(settings.instruction ?? ""),
    }),
    job.requested_clip_count,
  );
  const { data: planningRun, error: runError } = await supabase
    .from("planning_runs")
    .insert({
      clip_job_id: job.id,
      provider: "openrouter",
      model: env.OPENROUTER_CLIP_MODEL,
      prompt_version: "clip-planner-v1",
      schema_version: "clip-candidate-v1",
      status: "succeeded",
      completed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (runError) throw runError;
  const children = [];
  for (let index = 0; index < candidates.length; index++) {
    const item = candidates[index];
    const { data: candidate, error: candidateError } = await supabase
      .from("clip_candidates")
      .insert({
        clip_job_id: job.id,
        planning_run_id: planningRun.id,
        start_seconds: item.startSeconds,
        end_seconds: item.endSeconds,
        title: item.title,
        hook: item.hook,
        summary: item.summary,
        topic: item.topic,
        transcript_excerpt: item.transcriptExcerpt,
        standalone_score: item.standaloneScore,
        hook_score: item.hookScore,
        clarity_score: item.clarityScore,
        story_score: item.storyScore,
        relevance_score: item.relevanceScore,
        technical_score: item.overallScore,
        overall_score: item.overallScore,
        selection_reason: item.explanation,
        rank: index + 1,
        status: "selected",
      })
      .select("id")
      .single();
    if (candidateError) throw candidateError;
    const { data: clip, error: clipError } = await supabase
      .from("clips")
      .insert({
        clip_job_id: job.id,
        clip_candidate_id: candidate.id,
        title: item.title,
        status: "queued",
        selected: true,
        duration_seconds: item.endSeconds - item.startSeconds,
      })
      .select("id")
      .single();
    if (clipError) throw clipError;
    children.push({
      taskType: "render_clip_preview",
      input: { clipId: clip.id, candidateId: candidate.id },
      dependencyGroup: "previews",
      idempotencyKey: `${job.id}:preview:${clip.id}`,
    });
  }
  return {
    output: { candidateCount: candidates.length },
    jobStatus: "rendering_previews",
    message: `Selected ${candidates.length} diverse complete moments.`,
    children,
  };
}

async function preview(task: ClipTask): Promise<TaskResult> {
  return withTaskDirectory(task, async (directory) => {
    const { job, target } = await downloadJobSource(task.clip_job_id, directory);
    const clipId = uuid.parse(task.input_json.clipId);
    const candidateId = uuid.parse(task.input_json.candidateId);
    const { data: candidate, error } = await supabase
      .from("clip_candidates")
      .select("*")
      .eq("id", candidateId)
      .single();
    if (error) throw error;
    const output = join(directory, "preview.mp4");
    await renderClip({
      source: target,
      output,
      start: Number(candidate.start_seconds),
      duration: Number(candidate.end_seconds) - Number(candidate.start_seconds),
      width: 720,
      height: 1280,
      watermark: job.watermark_required,
    });
    const path = immutablePath(job, "previews", "mp4");
    await uploadAsset("clip-previews", path, output, "video/mp4");
    const assetId = await insertAsset(job, {
      bucket: "clip-previews",
      path,
      name: `${candidate.title} preview`,
      mime: "video/mp4",
      size: (await stat(output)).size,
      checksum: await sha256(output),
    });
    const { error: updateError } = await supabase
      .from("clips")
      .update({ preview_asset_id: assetId, status: "ready", updated_at: new Date().toISOString() })
      .eq("id", clipId);
    if (updateError) throw updateError;
    const { count } = await supabase
      .from("clips")
      .select("id", { count: "exact", head: true })
      .eq("clip_job_id", job.id)
      .eq("status", "ready");
    await supabase
      .from("clip_jobs")
      .update({ completed_clip_count: count ?? 0, updated_at: new Date().toISOString() })
      .eq("id", job.id);
    return {
      output: { assetId, path },
      message: "Preview rendered with server-side entitlement watermarking.",
    };
  });
}

async function detectScenes(task: ClipTask): Promise<TaskResult> {
  return withTaskDirectory(task, async (directory) => {
    const { target } = await downloadJobSource(task.clip_job_id, directory);
    const info = await probeMedia(target);
    if (!info.hasVideo)
      return {
        output: { sceneTimestamps: [] },
        message: "Audio-only source does not require scene detection.",
      };
    const { stderr } = await execa(
      env.FFMPEG_PATH,
      [
        "-hide_banner",
        "-nostdin",
        "-i",
        target,
        "-filter:v",
        "select='gt(scene,0.35)',showinfo",
        "-f",
        "null",
        "-",
      ],
      { timeout: 60 * 60_000, reject: false },
    );
    const timestamps = [...stderr.matchAll(/pts_time:([0-9.]+)/g)].map((match) => Number(match[1]));
    return {
      output: { sceneTimestamps: timestamps },
      message: `Detected ${timestamps.length} scene changes.`,
    };
  });
}

export async function handleTask(task: ClipTask, signal?: AbortSignal): Promise<TaskResult> {
  if (signal?.aborted) throw new TaskFailure("cancelled", "Worker is shutting down.", true);
  switch (task.task_type) {
    case "validate_source":
      return validateSource(task);
    case "download_direct_source":
      return downloadDirect(task);
    case "download_youtube_source":
      return downloadYouTube(task, signal);
    case "create_proxy":
      return proxy(task);
    case "extract_audio":
      return audio(task);
    case "detect_scenes":
      return detectScenes(task);
    case "split_audio":
      return splitAudio(task);
    case "transcribe_chunk":
      return transcribe(task);
    case "merge_transcript":
      return mergeTranscript(task);
    case "generate_candidate_windows":
      return plan(task);
    case "render_clip_preview":
      return preview(task);
    case "render_clip_export":
      return renderExport(task);
    case "render_batch_export":
      return renderBatchExport(task);
    case "publish_youtube_video":
      return publishYouTubeVideo(task);
    case "delete_expired_assets":
      return deleteExpiredAssets(task);
    default:
      throw new TaskFailure(
        "unsupported_task",
        `Worker task ${task.task_type} is not supported by this worker version.`,
        false,
      );
  }
}
