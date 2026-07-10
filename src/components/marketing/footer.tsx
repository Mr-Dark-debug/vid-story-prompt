import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/primitives/logo";
import { footerColumns } from "@/config/nav";
import { brand } from "@/config/brand";

export function MarketingFooter() {
  return (
    <footer className="border-t border-line bg-surface-raised">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm text-ink-soft">
            {brand.name} is a browser-first, project-aware AI video editor. Bring your footage, describe the story.
          </p>
        </div>
        {footerColumns.map((col) => (
          <div key={col.title}>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-mute">
              {col.title}
            </div>
            <ul className="space-y-2">
              {col.items.map((it) => (
                <li key={it.to}>
                  <Link to={it.to} className="text-sm text-ink-soft hover:text-ink">
                    {it.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line/70">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 px-5 py-5 text-xs text-ink-mute sm:flex-row sm:items-center sm:px-8">
          <div>© {new Date().getFullYear()} {brand.name}. Working name — subject to change.</div>
          <div>Made for creators who still want the final cut in their hands.</div>
        </div>
      </div>
    </footer>
  );
}