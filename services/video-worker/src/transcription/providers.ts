import { openAsBlob } from "node:fs";
import { z } from "zod";
import { env } from "../config/env.js";
import { TaskFailure } from "../domain/types.js";

export type TranscriptWord = { word: string; start: number; end: number };
export type TranscriptResult = { text: string; language?: string; words: TranscriptWord[]; provider: string; model: string };
export interface TranscriptionProvider { transcribe(file: string, signal?: AbortSignal): Promise<TranscriptResult> }
const resultSchema = z.object({ text: z.string(), language: z.string().optional(), words: z.array(z.object({ word: z.string(), start: z.number(), end: z.number() })).optional(), segments: z.array(z.object({ text: z.string(), start: z.number(), end: z.number() })).optional() });

async function requestTranscription(provider: string, endpoint: string, key: string, model: string, file: string, signal?: AbortSignal): Promise<TranscriptResult> {
  const form = new FormData(); form.set("file", await openAsBlob(file), "audio.flac"); form.set("model", model); form.set("response_format", "verbose_json"); form.set("timestamp_granularities[]", "word");
  const response = await fetch(endpoint, { method: "POST", headers: { authorization: `Bearer ${key}` }, body: form, signal });
  if (!response.ok) throw new TaskFailure(response.status === 429 ? "rate_limit" : response.status >= 500 ? "provider_5xx" : "transcription_rejected", `${provider} transcription returned ${response.status}.`, response.status === 429 || response.status >= 500);
  const parsed = resultSchema.parse(await response.json());
  return { text: parsed.text, language: parsed.language, words: parsed.words ?? parsed.segments?.flatMap((segment) => [{ word: segment.text, start: segment.start, end: segment.end }]) ?? [], provider, model };
}

export async function transcribeWithFallback(file: string, signal?: AbortSignal) {
  if (!env.GROQ_API_KEY && !env.OPENAI_API_KEY) throw new TaskFailure("provider_not_configured", "Configure GROQ_API_KEY or OPENAI_API_KEY for transcription.", false);
  if (env.GROQ_API_KEY) { try { return await requestTranscription("groq","https://api.groq.com/openai/v1/audio/transcriptions",env.GROQ_API_KEY,env.GROQ_TRANSCRIPTION_MODEL,file,signal); } catch (error) { if (!(error instanceof TaskFailure) || !error.retryable || !env.OPENAI_API_KEY) throw error; } }
  return requestTranscription("openai","https://api.openai.com/v1/audio/transcriptions",env.OPENAI_API_KEY!,env.OPENAI_TRANSCRIPTION_MODEL,file,signal);
}
