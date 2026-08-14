import { createFileRoute, notFound } from "@tanstack/react-router";
import { BlogIndex } from "@/features/blog/components/blog-index";
import { listPublishedBlogArticles } from "@/features/blog/content.server";
import { blogCategorySlug } from "@/features/blog/category";
import { absoluteUrl } from "@/config/seo";

export const Route = createFileRoute("/blog/category/$category")({
  loader: async ({ params }) => {
    const allArticles = await listPublishedBlogArticles();
    const articles = allArticles.filter(
      (article) => blogCategorySlug(article.category) === params.category,
    );
    if (articles.length === 0) throw notFound();
    return { articles, category: articles[0]!.category, categorySlug: params.category };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const title = `${loaderData.category} Guides | Vidrial Blog`;
    const description = `Practical, sourced Vidrial guides about ${loaderData.category.toLocaleLowerCase("en-US")}.`;
    const canonical = absoluteUrl(`/blog/category/${loaderData.categorySlug}`);
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "robots", content: "index,follow" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: canonical },
        { name: "twitter:card", content: "summary" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: canonical }],
    };
  },
  component: BlogCategoryRoute,
});

function BlogCategoryRoute() {
  const data = Route.useLoaderData();
  return <BlogIndex articles={data.articles} initialCategory={data.category} />;
}
