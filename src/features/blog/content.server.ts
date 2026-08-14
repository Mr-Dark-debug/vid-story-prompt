import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { BlogArticle, BlogArticleMeta } from "./schema";

function articleMeta(article: BlogArticle): BlogArticleMeta {
  const { body: _body, sourcePath: _sourcePath, ...meta } = article;
  return meta;
}

export const listPublishedBlogArticles = createServerFn({ method: "GET" }).handler(async () => {
  const { getPublishedArticles } = await import("./repository.server");
  return getPublishedArticles().map(articleMeta);
});

export const loadBlogArticlePage = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string().max(160) }))
  .handler(async ({ data }) => {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug)) return null;
    const { getPublishedArticles } = await import("./repository.server");
    const articles = getPublishedArticles();
    const article = articles.find((candidate) => candidate.slug === data.slug);
    if (!article) return null;
    const currentIndex = articles.findIndex((candidate) => candidate.slug === data.slug);
    const bySlug = new Map(articles.map((candidate) => [candidate.slug, candidate]));
    return {
      article,
      relatedArticles: article.related
        .map((slug) => bySlug.get(slug))
        .filter((candidate): candidate is BlogArticle => Boolean(candidate))
        .map(articleMeta),
      previous: articles[currentIndex - 1] ? articleMeta(articles[currentIndex - 1]!) : undefined,
      next: articles[currentIndex + 1] ? articleMeta(articles[currentIndex + 1]!) : undefined,
    };
  });
