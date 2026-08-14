import { ArrowUpRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { BlogArticleMeta } from "@/features/blog/schema";
import { formatUtcDate } from "@/lib/format-date";
import { trackBlogEvent } from "./blog-analytics";

export function ArticleCard({ article, index }: { article: BlogArticleMeta; index: number }) {
  return (
    <article className="group border-t border-line pt-5 sm:pt-6">
      <div className="flex items-start justify-between gap-5">
        <div className="font-mono text-[11px] text-ink-mute">{String(index + 1).padStart(2, "0")}</div>
        <div className="text-right text-[11px] font-semibold uppercase tracking-[0.13em] text-ember-ink">
          {article.category}
        </div>
      </div>
      <h2 className="mt-8 max-w-xl font-display text-2xl font-semibold leading-[1.12] tracking-[-0.035em] text-ink sm:text-[1.8rem]">
        <Link
          to="/blog/$slug"
          params={{ slug: article.slug }}
          className="rounded-sm decoration-1 underline-offset-[5px] group-hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember"
        >
          {article.title}
        </Link>
      </h2>
      <p className="mt-3 max-w-xl text-sm leading-6 text-ink-soft sm:text-[15px]">
        {article.description}
      </p>
      <div className="mt-7 flex items-center justify-between gap-4 border-b border-line pb-5 text-xs text-ink-mute sm:pb-6">
        <span>
          <time dateTime={article.updatedAt}>{formatUtcDate(article.updatedAt)}</time>
          <span aria-hidden> · </span>
          {article.readingTime} min read
        </span>
        <Link
          to="/blog/$slug"
          params={{ slug: article.slug }}
          onClick={() => trackBlogEvent("related_article_click", { slug: article.slug })}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-sm font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember"
          aria-label={`Read ${article.title}`}
        >
          Read guide <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </article>
  );
}
