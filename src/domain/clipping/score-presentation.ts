export type ClipStrengthBand = "strong" | "promising" | "needs_work" | "limited";

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
