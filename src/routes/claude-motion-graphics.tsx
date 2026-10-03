import { createFileRoute } from "@tanstack/react-router";
import { MotionPublicPage } from "@/components/motion/public-page";
import { pageMeta } from "@/config/seo";
import { loadPublicMotionCatalog } from "@/services/motion/public";

export const Route = createFileRoute("/claude-motion-graphics")({
  loader: loadPublicMotionCatalog,
  head: () =>
    pageMeta({
      title: "Claude Motion Graphics: Original Examples & Studio — Vidrial",
      description:
        "Browse original motion briefs and code-drawn examples. Start an HTML animation with a private prompt, choose your format, and continue into Vidrial Motion Studio.",
      path: "/claude-motion-graphics",
    }),
  component: GeneratorPage,
});

function GeneratorPage() {
  return <MotionPublicPage {...Route.useLoaderData()} generator />;
}
