export const MOTION_CATEGORIES = [
  {
    slug: "launch-film",
    label: "Launch films",
    description: "Original prompts for a focused product introduction.",
  },
  {
    slug: "product-demo",
    label: "Product demos",
    description: "Show a product workflow with readable motion.",
  },
  {
    slug: "showreel",
    label: "Showreels",
    description: "Build a coherent sequence of motion studies.",
  },
  {
    slug: "ad-edit",
    label: "Ads and edits",
    description: "Compose short messages with deliberate pacing.",
  },
  {
    slug: "explainer",
    label: "Explainers",
    description: "Explain an idea using shapes, labels and transitions.",
  },
  {
    slug: "tutorial",
    label: "Tutorials",
    description: "Teach a sequence with precise visual steps.",
  },
  {
    slug: "kinetic-typography",
    label: "Kinetic typography",
    description: "Give exact words an expressive rhythm.",
  },
  {
    slug: "logo-reveal",
    label: "Logo reveals",
    description: "Introduce an original or authorised identity.",
  },
  {
    slug: "data-story",
    label: "Data stories",
    description: "Animate supplied numbers without inventing data.",
  },
  {
    slug: "3d-loop",
    label: "3D loops",
    description: "Create a deterministic procedural spatial loop.",
  },
] as const;
export type MotionCategory = (typeof MOTION_CATEGORIES)[number]["slug"];
export function isMotionCategory(value: string): value is MotionCategory {
  return MOTION_CATEGORIES.some((category) => category.slug === value);
}
