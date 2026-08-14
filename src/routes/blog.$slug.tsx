import { createFileRoute, notFound } from "@tanstack/react-router";
import { ArticlePage } from "@/features/blog/components/article-page";
import { loadBlogArticlePage } from "@/features/blog/content.server";
import {
  articleMeta,
  blogPostingJsonLd,
  breadcrumbJsonLd,
  serializeJsonLd,
} from "@/features/blog/seo";

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    const data = await loadBlogArticlePage({ data: { slug: params.slug } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => (loaderData ? articleMeta(loaderData.article) : {}),
  component: BlogArticleRoute,
});

function BlogArticleRoute() {
  const data = Route.useLoaderData();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(blogPostingJsonLd(data.article)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd(data.article)) }}
      />
      <ArticlePage {...data} />
    </>
  );
}
