import { createFileRoute } from "@tanstack/react-router";
import { MotionPublicPage } from "@/components/motion/public-page";
import { pageMeta } from "@/config/seo";
import { loadPublicMotionCatalog } from "@/services/motion/public";

export const Route = createFileRoute("/prompts/")({
  loader: loadPublicMotionCatalog,
  head: () =>
    pageMeta({
      title: "HTML Motion Graphics Prompt Library — Vidrial",
      description:
        "Explore original copyable briefs for code-drawn motion graphics, kinetic typography, product demos and explainers. Preview examples and open Motion Studio.",
      path: "/prompts",
    }),
  component: PromptsPage,
});

function PromptsPage() {
  return <MotionPublicPage {...Route.useLoaderData()} />;
}
