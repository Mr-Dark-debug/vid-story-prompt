import { ArrowLeft, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { BlogArticleMeta } from "@/features/blog/schema";

export function ArticleNavigation({
  previous,
  next,
}: {
  previous?: BlogArticleMeta;
  next?: BlogArticleMeta;
}) {
  if (!previous && !next) return null;
  return (
    <nav aria-label="Adjacent articles" className="mt-16 grid border-y border-line sm:grid-cols-2">
      {previous ? (
        <Link
          to="/blog/$slug"
          params={{ slug: previous.slug }}
          className="group min-h-32 border-b border-line p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ember sm:border-b-0 sm:border-r sm:p-7"
        >
          <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.13em] text-ink-mute">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Previous
          </span>
          <span className="mt-3 block font-display text-lg font-semibold leading-snug text-ink group-hover:underline">
            {previous.title}
          </span>
        </Link>
      ) : (
        <div className="hidden sm:block" />
      )}
      {next && (
        <Link
          to="/blog/$slug"
          params={{ slug: next.slug }}
          className="group min-h-32 p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ember sm:p-7 sm:text-right"
        >
          <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.13em] text-ink-mute sm:justify-end">
            Next <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </span>
          <span className="mt-3 block font-display text-lg font-semibold leading-snug text-ink group-hover:underline">
            {next.title}
          </span>
        </Link>
      )}
    </nav>
  );
}
