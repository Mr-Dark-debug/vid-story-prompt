export type ClipStrengthBand = "strong" | "promising" | "needs_work" | "limited";

export function candidateScore(score: unknown, origin = "ai_discovery"): number | null {
  if (
    origin !== "ai_discovery" ||
    typeof score !== "number" ||
    !Number.isFinite(score) ||
    score < 0 ||
    score > 100
  )
    return null;
  return Math.round(score);
}

export function clipStrengthBand(score: number): ClipStrengthBand {
  if (score >= 80) return "strong";
  if (score >= 65) return "promising";
  if (score >= 40) return "needs_work";
  return "limited";
}

export const clipStrengthLabel: Record<ClipStrengthBand, string> = {
  strong: "Strong",
  promising: "Promising",
  needs_work: "Needs work",
  limited: "Limited",
};
