import originals from "../../../content/motion/prompts.json";
import verifiedAssets from "../../../content/motion/assets.json";

export interface PublicMotionPrompt {
  id: string;
  slug: string;
  title: string;
  prompt: string;
  description?: string;
  category: string;
  tags: string[];
  aspect: string;
  durationSeconds: number;
  recommendedModel?: string | null;
  authorDisplayName: string;
  createdAt: string;
  previewUrl?: string | null;
  posterUrl?: string | null;
  viewCount: number;
  likeCount: number;
  copyCount: number;
  useCount: number;
  localOriginal?: boolean;
}

type Asset = {
  videoUrl: string;
  posterUrl: string;
  width: number;
  height: number;
  durationSeconds: number;
};
const assets: Record<string, Asset> = verifiedAssets;

/** Original authored examples, never passed off as completed model generations. */
export const officialMotionPrompts: PublicMotionPrompt[] = originals.map((entry) => ({
  ...entry,
  id: entry.slug,
  authorDisplayName: "Vidrial Editorial Team",
  createdAt: "2026-10-03T00:00:00Z",
  recommendedModel: null,
  previewUrl: assets[entry.slug]?.videoUrl ?? null,
  posterUrl: assets[entry.slug]?.posterUrl ?? null,
  viewCount: 0,
  likeCount: 0,
  copyCount: 0,
  useCount: 0,
  localOriginal: true,
}));

export const motionCollections = [
  {
    slug: "claude-opus-5-5",
    title: "Claude motion graphics prompts",
    description:
      "Original, model-independent HTML animation briefs you can adapt for Claude Opus 5.5 when it is available in your configured models.",
  },
] as const;

export function filterMotionPrompts(
  prompts: readonly PublicMotionPrompt[],
  {
    category = "",
    model = "",
    style = "",
    query = "",
    sort = "newest",
  }: { category?: string; model?: string; style?: string; query?: string; sort?: string },
) {
  const term = query.trim().toLocaleLowerCase("en");
  return prompts
    .filter(
      (item) =>
        (!category || item.category === category) &&
        (!model || item.recommendedModel === model) &&
        (!style || item.tags.includes(style)) &&
        (!term ||
          `${item.title} ${item.prompt} ${item.tags.join(" ")}`
            .toLocaleLowerCase("en")
            .includes(term)),
    )
    .sort((a, b) => {
      const metric =
        sort === "likes"
          ? b.likeCount - a.likeCount
          : sort === "views"
            ? b.viewCount - a.viewCount
            : sort === "trending"
              ? b.likeCount + b.useCount + b.copyCount - (a.likeCount + a.useCount + a.copyCount)
              : 0;
      return metric || b.createdAt.localeCompare(a.createdAt) || a.slug.localeCompare(b.slug);
    });
}
