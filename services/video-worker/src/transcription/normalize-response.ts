import { z } from "zod";
import { TaskFailure } from "../domain/types.js";

export type TranscriptWord = { word: string; start: number; end: number };

const timestampSchema = z.coerce.number().finite().nonnegative();
const wordSchema = z.object({
  word: z.string().optional(),
  text: z.string().optional(),
  start: timestampSchema,
  end: timestampSchema,
});
const segmentSchema = z.object({
  text: z.string(),
  start: timestampSchema,
  end: timestampSchema,
});
const providerResultSchema = z.object({
  text: z.string(),
  language: z.string().nullish(),
  duration: timestampSchema.nullish(),
  words: z.array(wordSchema).nullish(),
  segments: z.array(segmentSchema).nullish(),
});

export function normalizeTranscriptionResponse(input: unknown): {
  text: string;
  language?: string;
  words: TranscriptWord[];
} {
  const parsed = providerResultSchema.safeParse(input);
  if (!parsed.success) {
    throw new TaskFailure(
      "transcription_invalid_response",
      "The transcription provider returned an invalid response.",
      true,
    );
  }

  const words = (parsed.data.words ?? [])
    .map((item) => ({
      word: (item.word ?? item.text ?? "").trim(),
      start: item.start,
      end: item.end,
    }))
    .filter((item) => item.word.length > 0 && item.end > item.start);
  const segments = (parsed.data.segments ?? [])
    .map((item) => ({ word: item.text.trim(), start: item.start, end: item.end }))
    .filter((item) => item.word.length > 0 && item.end > item.start);
  const fallbackEnd = Math.max(0.01, parsed.data.duration ?? 1);
  const timestamps = words.length
    ? words
    : segments.length
      ? segments
      : parsed.data.text.trim()
        ? [{ word: parsed.data.text.trim(), start: 0, end: fallbackEnd }]
        : [];

  return {
    text: parsed.data.text,
    ...(parsed.data.language ? { language: parsed.data.language } : {}),
    words: timestamps,
  };
}
