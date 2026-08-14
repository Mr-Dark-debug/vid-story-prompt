import type { BlogHeading } from "@/features/blog/schema";
import { cn } from "@/lib/utils";

export function ArticleToc({ headings }: { headings: BlogHeading[] }) {
  return (
    <nav aria-label="Table of contents">
      <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-ink-mute">
        In this guide
      </div>
      <ol className="mt-4 space-y-2.5 border-l border-line pl-4">
        {headings
          .filter((heading) => heading.level <= 3)
          .map((heading) => (
            <li key={heading.id}>
              <a
                href={`#${heading.id}`}
                className={cn(
                  "block rounded-sm text-xs leading-5 text-ink-mute transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember",
                  heading.level === 3 && "pl-3",
                )}
              >
                {heading.text}
              </a>
            </li>
          ))}
      </ol>
    </nav>
  );
}
