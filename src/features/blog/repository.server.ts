import {
  validateBlogCorpus,
  type BlogArticle,
} from "./schema";

const rawArticleModules = import.meta.glob<string>("../../../content/blog/*.md", {
  eager: true,
  import: "default",
  query: "?raw",
});

export interface BlogContentRepository {
  getPublishedArticles(): BlogArticle[];
  getAllArticlesForReview(): BlogArticle[];
  getPublishedArticle(slug: string): BlogArticle | undefined;
  getBlogCategories(): string[];
}

export function createBlogRepository(rawArticles: Record<string, string>): BlogContentRepository {
  const articles = Object.freeze(
    validateBlogCorpus(rawArticles).sort((left, right) => left.slug.localeCompare(right.slug)),
  );
  const published = Object.freeze(
    articles
      .filter((article) => !article.draft && article.reviewStatus === "PASS")
      .sort(comparePublishedArticles),
  );

  return {
    getPublishedArticles: () => [...published],
    getAllArticlesForReview: () => [...articles],
    getPublishedArticle: (slug) => published.find((article) => article.slug === slug),
    getBlogCategories: () =>
      [...new Set(published.map((article) => article.category))].sort((left, right) =>
        left.localeCompare(right, "en", { sensitivity: "base" }),
      ),
  };
}

const repository = createBlogRepository(rawArticleModules);

export function getPublishedArticles(): BlogArticle[] {
  return repository.getPublishedArticles();
}

export function getAllArticlesForReview(): BlogArticle[] {
  return repository.getAllArticlesForReview();
}

export function getPublishedArticle(slug: string): BlogArticle | undefined {
  return repository.getPublishedArticle(slug);
}

export function getBlogCategories(): string[] {
  return repository.getBlogCategories();
}

function comparePublishedArticles(left: BlogArticle, right: BlogArticle): number {
  return (
    right.publishedAt.localeCompare(left.publishedAt) ||
    right.updatedAt.localeCompare(left.updatedAt) ||
    left.slug.localeCompare(right.slug)
  );
}
