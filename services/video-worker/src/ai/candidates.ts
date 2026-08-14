import type { z } from "zod";
import { clipCandidateSchema } from "./schema.js";

export type Candidate = z.infer<typeof clipCandidateSchema>;

export type TranscriptWord = {
  end: number;
  start: number;
  text: string;
};

export type CandidateWindow = {
  clarityScore: number;
  endSeconds: number;
  excerpt: string;
  hookScore: number;
  id: string;
  preScore: number;
  relevanceScore: number;
  standaloneScore: number;
  startSeconds: number;
  storyScore: number;
  technicalScore: number;
};

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
const sentenceEnd = /[.!?]["')\]]?$/;
const hookPattern = /\b(why|how|what|never|stop|start|secret|mistake|imagine|here'?s|first|best|worst|\d+)\b/i;
const storyPattern = /\b(but|because|so|then|until|instead|therefore|finally|however|result)\b/i;

function scoreWindow(words: TranscriptWord[], instruction: string) {
  const excerpt = words.map((word) => word.text).join(" ").replace(/\s+/g, " ").trim();
  const duration = Math.max(1, words.at(-1)!.end - words[0].start);
  const density = words.length / duration;
  const opening = words.slice(0, 12).map((word) => word.text).join(" ");
  const instructionTerms = new Set(
    normalized(instruction)
      .split(/\s+/)
      .filter((term) => term.length >= 4),
  );
  const excerptTerms = new Set(normalized(excerpt).split(/\s+/));
  const relevanceHits = [...instructionTerms].filter((term) => excerptTerms.has(term)).length;
  const durationFit = 100 - Math.min(100, Math.abs(duration - 42) * 3.2);
  const technicalScore = clampScore(durationFit * 0.55 + Math.min(100, density * 45) * 0.45);
  const hookScore = clampScore(48 + (hookPattern.test(opening) ? 34 : 0) + (/[?!]/.test(opening) ? 12 : 0));
  const clarityScore = clampScore(55 + (sentenceEnd.test(excerpt) ? 25 : 0) + (density >= 1.2 ? 12 : 0));
  const standaloneScore = clampScore(
    50 + (sentenceEnd.test(excerpt) ? 20 : 0) + (words.length >= 35 ? 15 : 0),
  );
  const storyScore = clampScore(48 + (storyPattern.test(excerpt) ? 32 : 0) + (words.length >= 50 ? 10 : 0));
  const relevanceScore = instructionTerms.size
    ? clampScore(45 + (relevanceHits / instructionTerms.size) * 55)
    : 70;
  const preScore = clampScore(
    hookScore * 0.22 +
      clarityScore * 0.2 +
      standaloneScore * 0.2 +
      storyScore * 0.14 +
      relevanceScore * 0.14 +
      technicalScore * 0.1,
  );
  return {
    clarityScore,
    excerpt,
    hookScore,
    preScore,
    relevanceScore,
    standaloneScore,
    storyScore,
    technicalScore,
  };
}

export function estimateTranscriptWords(text: string, durationSeconds: number): TranscriptWord[] {
  const tokens = text.split(/\s+/).filter(Boolean).slice(0, 30_000);
  if (!tokens.length) return [];
  const step = Math.max(0.05, durationSeconds / tokens.length);
  return tokens.map((token, index) => ({
    start: index * step,
    end: Math.min(durationSeconds, (index + 1) * step),
    text: token,
  }));
}

export function buildCandidateWindows(input: {
  durationSeconds: number;
  instruction: string;
  maximumWindows: number;
  words: TranscriptWord[];
}): CandidateWindow[] {
  const words = input.words
    .filter(
      (word) =>
        Number.isFinite(word.start) &&
        Number.isFinite(word.end) &&
        word.start >= 0 &&
        word.end > word.start &&
        word.start < input.durationSeconds &&
        word.text.trim(),
    )
    .sort((a, b) => a.start - b.start)
    .slice(0, 30_000);
  if (!words.length) return [];

  const boundaries = [0];
  for (let index = 1; index < words.length; index++) {
    const previous = words[index - 1];
    if (
      words[index].start - previous.end >= 1.1 ||
      sentenceEnd.test(previous.text)
    ) {
      boundaries.push(index);
    }
  }

  const raw: CandidateWindow[] = [];
  for (const startIndex of boundaries) {
    const start = words[startIndex].start;
    let bestEndIndex = -1;
    for (let index = startIndex; index < words.length; index++) {
      const duration = words[index].end - start;
      if (duration > 62) break;
      if (duration >= 22 && (sentenceEnd.test(words[index].text) || duration >= 52)) {
        bestEndIndex = index;
        if (duration >= 32) break;
      }
    }
    if (bestEndIndex < startIndex) continue;
    const windowWords = words.slice(startIndex, bestEndIndex + 1);
    const scores = scoreWindow(windowWords, input.instruction);
    raw.push({
      ...scores,
      id: "",
      startSeconds: Number(start.toFixed(3)),
      endSeconds: Number(Math.min(input.durationSeconds, windowWords.at(-1)!.end).toFixed(3)),
    });
  }

  const selected: CandidateWindow[] = [];
  for (const window of raw.sort(
    (a, b) => b.preScore - a.preScore || a.startSeconds - b.startSeconds,
  )) {
    if (
      selected.some(
        (other) =>
          Math.abs(other.startSeconds - window.startSeconds) < 8 &&
          Math.min(other.endSeconds, window.endSeconds) -
            Math.max(other.startSeconds, window.startSeconds) >
            0.8 * Math.min(other.endSeconds - other.startSeconds, window.endSeconds - window.startSeconds),
      )
    ) {
      continue;
    }
    selected.push({ ...window, id: `window-${selected.length + 1}` });
    if (selected.length >= Math.max(1, Math.min(60, input.maximumWindows))) break;
  }
  return selected;
}

function shortTitle(excerpt: string) {
  const words = excerpt.replace(/[^\p{L}\p{N}\s'-]/gu, " ").split(/\s+/).filter(Boolean);
  const title = words.slice(0, 9).join(" ");
  return title.length > 100 ? `${title.slice(0, 97)}…` : title || "Selected moment";
}

export function fallbackCandidate(window: CandidateWindow): Candidate {
  const title = shortTitle(window.excerpt);
  const explanation = `Selected from transcript structure and timing. Hook ${window.hookScore}, clarity ${window.clarityScore}, standalone ${window.standaloneScore}, and story completeness ${window.storyScore}.`;
  return clipCandidateSchema.parse({
    startSeconds: window.startSeconds,
    endSeconds: window.endSeconds,
    title,
    hook: window.excerpt.slice(0, 220),
    summary: window.excerpt.slice(0, 480),
    topic: title,
    transcriptExcerpt: window.excerpt,
    standaloneScore: window.standaloneScore,
    hookScore: window.hookScore,
    clarityScore: window.clarityScore,
    storyScore: window.storyScore,
    relevanceScore: window.relevanceScore,
    technicalScore: window.technicalScore,
    overallScore: window.preScore,
    explanation,
    socialCopy: {
      youtubeShorts: `${title} #Shorts`,
      instagram: `${title}\n\nCreated from an authorised source.`,
      tiktok: `${title} #LearnOnTikTok`,
      linkedin: `${title}\n\nA concise takeaway from an authorised source video.`,
    },
  });
}
