import { ListChecks } from "lucide-react";

export function ArticleSummary({ items }: { items: string[] }) {
  return (
    <aside className="my-10 border-y border-line bg-surface-raised px-5 py-6 sm:px-7 sm:py-7" aria-labelledby="ai-summary-title">
      <div className="flex items-center gap-2 text-ember-ink">
        <ListChecks className="h-4 w-4" aria-hidden />
        <h2 id="ai-summary-title" className="font-display text-lg font-semibold tracking-[-0.02em] text-ink">
          AI Summary
        </h2>
      </div>
      <p className="mt-1 text-xs leading-5 text-ink-mute">
        A concise summary of the article. Read the full guide for context and sources.
      </p>
      <ul className="mt-5 space-y-3">
        {items.map((item) => (
          <li key={item} className="grid grid-cols-[12px_1fr] gap-3 text-sm leading-6 text-ink-soft">
            <span className="mt-[9px] h-1.5 w-1.5 rounded-full bg-ember" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
