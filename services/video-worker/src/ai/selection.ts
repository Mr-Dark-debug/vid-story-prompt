import type { Candidate } from "./candidates.js";

const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export const overlapRatio = (a: Candidate, b: Candidate) =>
  Math.max(0, Math.min(a.endSeconds, b.endSeconds) - Math.max(a.startSeconds, b.startSeconds)) /
  Math.max(1, Math.min(a.endSeconds - a.startSeconds, b.endSeconds - b.startSeconds));

export function selectDiverseCandidates(candidates: Candidate[], count: number) {
  const sorted = [...candidates].sort(
    (a, b) =>
      b.overallScore - a.overallScore ||
      b.standaloneScore - a.standaloneScore ||
      a.startSeconds - b.startSeconds,
  );
  const selected: Candidate[] = [];
  const topicCounts = new Map<string, number>();
  for (const candidate of sorted) {
    const topic = normalized(candidate.topic);
    if (
      selected.some(
        (item) =>
          overlapRatio(item, candidate) > 0.5 ||
          normalized(item.transcriptExcerpt) === normalized(candidate.transcriptExcerpt) ||
          normalized(item.title) === normalized(candidate.title),
      ) ||
      (topic && (topicCounts.get(topic) ?? 0) >= Math.max(1, Math.ceil(count / 3)))
    ) {
      continue;
    }
    selected.push(candidate);
    if (topic) topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
    if (selected.length >= count) break;
  }
  return selected;
}
