import { createFileRoute } from "@tanstack/react-router";
import { BlogIndex } from "@/features/blog/components/blog-index";
import { listPublishedBlogArticles } from "@/features/blog/content.server";
import { pageMeta } from "@/config/seo";

const description =
  "Practical, sourced guides for AI video clipping, captions, podcast repurposing, YouTube Shorts and editable creator workflows.";

export const Route = createFileRoute("/blog/")({
  loader: () => listPublishedBlogArticles(),
  head: () =>
    pageMeta({
      title: "Vidrial Blog — Practical AI Video Editing Guides",
      description,
      path: "/blog",
    }),
  component: BlogIndexRoute,
});

function BlogIndexRoute() {
  const articles = Route.useLoaderData();
  return <BlogIndex articles={articles} />;
}
