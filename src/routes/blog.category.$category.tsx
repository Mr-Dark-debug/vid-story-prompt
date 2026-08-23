import { createFileRoute, notFound } from "@tanstack/react-router";
import { BlogIndex } from "@/features/blog/components/blog-index";
import { listPublishedBlogArticles } from "@/features/blog/content.server";
import { blogCategorySlug } from "@/features/blog/category";
import { pageMeta } from "@/config/seo";

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
    return pageMeta({
      title,
      description,
      path: `/blog/category/${loaderData.categorySlug}`,
    });
  },
  component: BlogCategoryRoute,
});

function BlogCategoryRoute() {
  const data = Route.useLoaderData();
  return <BlogIndex articles={data.articles} initialCategory={data.category} />;
}
