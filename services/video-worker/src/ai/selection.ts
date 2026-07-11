import type { z } from "zod";
import type { clipCandidateSchema } from "./schema.js";
export type Candidate = z.infer<typeof clipCandidateSchema>;
export const overlapRatio = (a: Candidate, b: Candidate) => Math.max(0, Math.min(a.endSeconds,b.endSeconds)-Math.max(a.startSeconds,b.startSeconds)) / Math.max(1,Math.min(a.endSeconds-a.startSeconds,b.endSeconds-b.startSeconds));
export function selectDiverseCandidates(candidates: Candidate[], count: number) {
  const sorted = [...candidates].sort((a,b) => b.overallScore-a.overallScore); const selected: Candidate[] = [];
  for (const candidate of sorted) { if (selected.some((item) => overlapRatio(item,candidate) > .55 || item.transcriptExcerpt.toLowerCase() === candidate.transcriptExcerpt.toLowerCase())) continue; selected.push(candidate); if (selected.length >= count) break; }
  return selected;
}
