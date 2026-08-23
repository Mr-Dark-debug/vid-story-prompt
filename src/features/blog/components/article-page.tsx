import { ArrowRight, ExternalLink } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import type { BlogArticle, BlogArticleMeta } from "@/features/blog/schema";
import { absoluteUrl } from "@/config/seo";
import { blogCategorySlug } from "@/features/blog/category";
import { formatUtcDate } from "@/lib/format-date";
import { ArticleBody } from "./article-body";
import { ArticleFeedback } from "./article-feedback";
import { ArticleNavigation } from "./article-navigation";
import { ArticleShare } from "./article-share";
import { ArticleSummary } from "./article-summary";
import { ArticleToc } from "./article-toc";
import { trackBlogEvent } from "./blog-analytics";

function ctaForCategory(category: string) {
  if (category.includes("Podcast")) {
    return {
      to: "/use-cases/podcasts" as const,
      title: "Keep the conversation. Cut the waiting.",
      body: "See how Vidrial turns authorised podcast footage into reviewable clip suggestions and an editable timeline.",
      label: "Explore podcast workflows",
    };
  }
  if (category.includes("YouTube")) {
    return {
      to: "/youtube-clipper" as const,
      title: "Try the workflow on a video you control.",
      body: "Bring an authorised YouTube source. Vidrial explains why it chose each moment before you edit or export it.",
      label: "Explore YouTube Clipper",
    };
  }
  if (category === "Captions" || category === "Editing workflow") {
    return {
      to: "/features" as const,
      title: "A first cut should still be yours to change.",
      body: "Review Vidrial's available, beta and planned editing capabilities before you choose a workflow.",
      label: "See Vidrial features",
    };
  }
  return {
    to: "/use-cases/short-form" as const,
    title: "From long source to editable short-form.",
    body: "Use AI to find a starting point, then keep control of the transcript, timing and final cut.",
    label: "Explore short-form workflows",
  };
}

export function ArticlePage({
  article,
  relatedArticles,
  previous,
  next,
}: {
  article: BlogArticle;
  relatedArticles: BlogArticleMeta[];
  previous?: BlogArticleMeta;
  next?: BlogArticleMeta;
}) {
  const canonicalUrl = absoluteUrl(article.canonicalPath);
  const cta = ctaForCategory(article.category);

  useEffect(() => {
    trackBlogEvent("blog_article_view", { slug: article.slug, category: article.category });
  }, [article.category, article.slug]);

  return (
    <article>
      <header className="border-b border-line bg-surface-panel">
        <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-16">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-ink-mute">
            <Link to="/" className="rounded-sm hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember">
              Home
            </Link>
            <span aria-hidden>/</span>
            <Link to="/blog" className="rounded-sm hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember">
              Blog
            </Link>
            <span aria-hidden>/</span>
            <Link
              to="/blog/category/$category"
              params={{ category: blogCategorySlug(article.category) }}
              className="rounded-sm text-ember-ink hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember"
            >
              {article.category}
            </Link>
          </nav>

          <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_220px] lg:items-end">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-ember-ink">
                {article.category}
              </div>
              <h1 className="mt-5 max-w-4xl font-display text-[2.65rem] font-semibold leading-[1.01] tracking-[-0.052em] text-ink sm:text-[4.25rem]">
                {article.title}
              </h1>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-ink-soft">{article.description}</p>
            </div>
            <dl className="grid grid-cols-2 gap-x-5 gap-y-4 border-t border-line pt-5 text-xs lg:grid-cols-1">
              <div>
                <dt className="text-ink-mute">Written by</dt>
                <dd className="mt-1 font-semibold text-ink">{article.author}</dd>
              </div>
              <div>
                <dt className="text-ink-mute">Published</dt>
                <dd className="mt-1 font-semibold text-ink">
                  <time dateTime={article.publishedAt}>{formatUtcDate(article.publishedAt)}</time>
                </dd>
              </div>
              <div>
                <dt className="text-ink-mute">Last reviewed</dt>
                <dd className="mt-1 font-semibold text-ink">
                  <time dateTime={article.reviewedAt}>{formatUtcDate(article.reviewedAt)}</time>
                </dd>
              </div>
              <div>
                <dt className="text-ink-mute">Updated</dt>
                <dd className="mt-1 font-semibold text-ink">
                  <time dateTime={article.updatedAt}>{formatUtcDate(article.updatedAt)}</time>
                </dd>
              </div>
              <div>
                <dt className="text-ink-mute">Reading time</dt>
                <dd className="mt-1 font-semibold text-ink">{article.readingTime} minutes</dd>
              </div>
            </dl>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[180px_minmax(0,680px)_132px] lg:items-start lg:justify-between">
        <aside className="hidden lg:sticky lg:top-28 lg:block">
          <ArticleToc headings={article.headings} />
        </aside>

        <div className="min-w-0">
          <details className="mb-8 border-y border-line py-4 lg:hidden">
            <summary className="cursor-pointer text-sm font-semibold text-ink">Table of contents</summary>
            <div className="mt-4">
              <ArticleToc headings={article.headings} />
            </div>
          </details>

          <ArticleSummary items={article.aiSummary} />
          <ArticleBody body={article.body} headings={article.headings} />

          {article.sources.length > 0 && (
            <section className="mt-14 border-t border-line pt-8" aria-labelledby="article-sources-title">
              <h2 id="article-sources-title" className="font-display text-2xl font-semibold tracking-[-0.03em] text-ink">
                Sources and further reading
              </h2>
              <ol className="mt-5 space-y-3">
                {article.sources.map((source, index) => (
                  <li key={source.url} className="grid grid-cols-[24px_1fr] gap-3 text-sm leading-6">
                    <span className="font-mono text-[10px] text-ink-mute">{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <a
                        href={source.url}
                        rel="noreferrer noopener"
                        className="inline-flex items-start gap-1 font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember"
                      >
                        {source.title} <ExternalLink className="mt-1 h-3 w-3 shrink-0" aria-hidden />
                      </a>
                      {source.checkedAt && (
                        <span className="ml-2 text-xs text-ink-mute">Checked {formatUtcDate(source.checkedAt)}</span>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {article.faqs.length > 0 && (
            <section className="mt-14 border-t border-line pt-8" aria-labelledby="article-faq-title">
              <h2 id="article-faq-title" className="font-display text-2xl font-semibold tracking-[-0.03em] text-ink">
                Questions creators ask
              </h2>
              <div className="mt-5 divide-y divide-line border-y border-line">
                {article.faqs.map((faq) => (
                  <details key={faq.question} className="group py-5">
                    <summary className="cursor-pointer list-none pr-8 font-semibold text-ink marker:hidden">
                      {faq.question}
                    </summary>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">{faq.answer}</p>
                  </details>
                ))}
              </div>
            </section>
          )}

          <section className="mt-14 bg-brand-charcoal p-6 text-white sm:p-9" aria-labelledby="article-cta-title">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-coral">Put the guide to work</div>
            <h2 id="article-cta-title" className="mt-4 max-w-xl font-display text-3xl font-semibold leading-tight tracking-[-0.04em] text-white">
              {cta.title}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/66">{cta.body}</p>
            <Link
              to={cta.to}
              onClick={() => trackBlogEvent("blog_cta_click", { slug: article.slug, category: article.category })}
              className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-full bg-coral px-5 text-sm font-semibold text-brand-charcoal transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {cta.label} <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </section>

          <ArticleFeedback slug={article.slug} />

          {relatedArticles.length > 0 && (
            <section className="mt-14" aria-labelledby="related-articles-title">
              <h2 id="related-articles-title" className="font-display text-2xl font-semibold tracking-[-0.03em] text-ink">
                Keep working through the topic
              </h2>
              <div className="mt-5 divide-y divide-line border-y border-line">
                {relatedArticles.map((related) => (
                  <Link
                    key={related.slug}
                    to="/blog/$slug"
                    params={{ slug: related.slug }}
                    onClick={() => trackBlogEvent("related_article_click", { slug: related.slug })}
                    className="group grid min-h-24 gap-3 py-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember sm:grid-cols-[1fr_auto] sm:items-center"
                  >
                    <span>
                      <span className="block text-[10px] font-semibold uppercase tracking-[0.13em] text-ember-ink">
                        {related.category}
                      </span>
                      <span className="mt-1 block font-display text-lg font-semibold text-ink group-hover:underline">
                        {related.title}
                      </span>
                    </span>
                    <span className="text-xs text-ink-mute">{related.readingTime} min</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <ArticleNavigation previous={previous} next={next} />
        </div>

        <aside className="order-first border-y border-line py-4 lg:order-none lg:sticky lg:top-28 lg:border-y-0 lg:py-0">
          <ArticleShare title={article.title} canonicalUrl={canonicalUrl} />
        </aside>
      </div>
    </article>
  );
}
