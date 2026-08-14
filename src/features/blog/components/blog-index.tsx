import { ArrowRight, Search, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { BlogArticleMeta } from "@/features/blog/schema";
import { blogCategorySlug } from "@/features/blog/category";
import { formatUtcDate } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import { ArticleCard } from "./article-card";
import { trackBlogEvent } from "./blog-analytics";

export function BlogIndex({
  articles,
  initialCategory,
}: {
  articles: BlogArticleMeta[];
  initialCategory?: string;
}) {
  const categories = useMemo(
    () => Array.from(new Set(articles.map((article) => article.category))).sort(),
    [articles],
  );
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(initialCategory ?? "All");
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
    trackBlogEvent("blog_view", {
      category: initialCategory,
      resultCount: articles.length,
    });
  }, [articles.length, initialCategory]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("en-US");
    return articles.filter((article) => {
      if (category !== "All" && article.category !== category) return false;
      if (!needle) return true;
      return [
        article.title,
        article.description,
        article.primaryKeyword,
        ...article.secondaryKeywords,
      ].some((value) => value.toLocaleLowerCase("en-US").includes(needle));
    });
  }, [articles, category, query]);

  const featured = articles.find((article) => article.featured) ?? articles[0];
  const latest = articles.filter((article) => article.slug !== featured?.slug).slice(0, 4);

  return (
    <div
      className="bg-surface-page"
      data-testid="blog-index"
      data-hydrated={hydrated ? "true" : "false"}
    >
      <section className="border-b border-line">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.35fr_.65fr] lg:items-end lg:py-28">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ember-ink">
              Vidrial field notes
            </p>
            <h1 className="mt-5 max-w-3xl font-display text-[3rem] font-semibold leading-[0.96] tracking-[-0.055em] text-ink sm:text-[4.4rem]">
              Better clips start with better decisions.
            </h1>
          </div>
          <div className="lg:pb-1">
            <p className="max-w-md text-base leading-7 text-ink-soft">
              Practical, sourced guides for turning authorised long-form media into clear, editable
              short clips—without pretending every workflow is automatic.
            </p>
            <div className="relative mt-7">
              <Search
                className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute"
                aria-hidden
              />
              <input
                type="search"
                name="blog-search"
                autoComplete="off"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onBlur={() =>
                  trackBlogEvent("blog_search", {
                    hasQuery: query.trim().length > 0,
                    resultCount: filtered.length,
                  })
                }
                placeholder="Search the library"
                aria-label="Search articles"
                className="h-12 w-full border-0 border-b border-line-strong bg-transparent pl-7 pr-10 text-sm text-ink outline-none placeholder:text-ink-mute focus:border-ember focus:ring-0"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-0 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center text-ink-mute hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="border-b border-line bg-surface-panel">
        <nav
          aria-label="Blog categories"
          className="scrollbar-hidden mx-auto flex w-full max-w-6xl gap-7 overflow-x-auto px-5 sm:px-8"
        >
          {["All", ...categories].map((item) => (
            <Link
              key={item}
              to={item === "All" ? "/blog" : "/blog/category/$category"}
              params={item === "All" ? undefined : { category: blogCategorySlug(item) }}
              onClick={() => {
                trackBlogEvent("blog_category_filter", {
                  category: item,
                  resultCount:
                    item === "All"
                      ? articles.length
                      : articles.filter((article) => article.category === item).length,
                });
              }}
              className={cn(
                "relative min-h-14 shrink-0 text-sm font-semibold text-ink-mute transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ember",
                category === item && "text-ink after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-ember",
              )}
              aria-current={category === item ? "page" : undefined}
            >
              {item}
            </Link>
          ))}
        </nav>
      </div>

      {!query && category === "All" && featured && (
        <section className="border-b border-line bg-brand-charcoal text-white">
          <div className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[.42fr_1.3fr_.5fr] lg:items-end">
            <div className="font-mono text-[5rem] leading-none text-white/14 sm:text-[7rem]">01</div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-coral">
                Featured · {featured.category}
              </div>
              <h2 className="mt-5 max-w-3xl font-display text-3xl font-semibold leading-[1.05] tracking-[-0.045em] text-white sm:text-5xl">
                <Link
                  to="/blog/$slug"
                  params={{ slug: featured.slug }}
                  className="rounded-sm decoration-1 underline-offset-[7px] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
                >
                  {featured.title}
                </Link>
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/66">
                {featured.description}
              </p>
            </div>
            <div className="border-t border-white/18 pt-4 text-sm text-white/58 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
              <div>{formatUtcDate(featured.updatedAt)}</div>
              <div className="mt-1">{featured.readingTime} min read</div>
              <Link
                to="/blog/$slug"
                params={{ slug: featured.slug }}
                className="mt-7 inline-flex min-h-11 items-center gap-2 font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
              >
                Read the guide <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        </section>
      )}

      {!query && category === "All" && latest.length > 0 && (
        <section className="border-b border-line bg-surface-panel">
          <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
            <div className="mb-8 flex items-baseline justify-between gap-5">
              <h2 className="font-display text-3xl font-semibold tracking-[-0.04em] text-ink">
                Latest field notes
              </h2>
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-mute">
                Updated, not abandoned
              </span>
            </div>
            <div className="grid gap-x-12 gap-y-10 md:grid-cols-2">
              {latest.map((article, index) => (
                <ArticleCard key={article.slug} article={article} index={index} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section>
        <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
          <div className="mb-9 flex flex-col justify-between gap-3 border-b border-line pb-5 sm:flex-row sm:items-end">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ember-ink">
                {category === "All" ? "The library" : category}
              </p>
              <h2 className="mt-2 font-display text-3xl font-semibold tracking-[-0.04em] text-ink">
                {query ? `Results for “${query.trim()}”` : "All practical guides"}
              </h2>
            </div>
            <div className="text-sm text-ink-mute" role="status" aria-live="polite">
              {filtered.length} {filtered.length === 1 ? "article" : "articles"}
            </div>
          </div>

          {filtered.length > 0 ? (
            <>
              <div className="grid gap-x-12 gap-y-12 md:grid-cols-2">
                {filtered.map((article, index) => (
                  <ArticleCard key={article.slug} article={article} index={index} />
                ))}
              </div>
            </>
          ) : (
            <div className="border-y border-line py-16 text-center">
              <h3 className="font-display text-2xl font-semibold text-ink">No matching guide yet.</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-soft">
                Try a broader phrase or clear the category filter. We would rather leave a gap than
                pad the library with a thin page.
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setCategory("All");
                }}
                className="mt-6 min-h-11 rounded-full border border-line-strong px-5 text-sm font-semibold text-ink hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember"
              >
                Reset filters
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
