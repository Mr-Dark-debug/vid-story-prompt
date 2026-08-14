import { createFileRoute } from "@tanstack/react-router";
import { BlogIndex } from "@/features/blog/components/blog-index";
import { listPublishedBlogArticles } from "@/features/blog/content.server";
import { absoluteUrl } from "@/config/seo";

const description =
  "Practical, sourced guides for AI video clipping, captions, podcast repurposing, YouTube Shorts and editable creator workflows.";

export const Route = createFileRoute("/blog/")({
  loader: () => listPublishedBlogArticles(),
  head: () => ({
    meta: [
      { title: "Vidrial Blog — Practical AI Video Editing Guides" },
      { name: "description", content: description },
      { name: "robots", content: "index,follow" },
      { property: "og:title", content: "Vidrial Blog — Practical AI Video Editing Guides" },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: absoluteUrl("/blog") },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Vidrial Blog — Practical AI Video Editing Guides" },
      { name: "twitter:description", content: description },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/blog") }],
  }),
  component: BlogIndexRoute,
});

function BlogIndexRoute() {
  const articles = Route.useLoaderData();
  return <BlogIndex articles={articles} />;
}
