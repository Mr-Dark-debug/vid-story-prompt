import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/primitives/logo";
import { footerColumns } from "@/config/nav";
import { brand } from "@/config/brand";

export function MarketingFooter() {
  return (
    <footer className="border-t border-white/10 bg-brand-charcoal text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div>
          <Logo tone="light" showTagline />
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-white/65">
            {brand.name} is a browser-first, project-aware AI video editor. Bring your footage,
            describe the story.
          </p>
        </div>
        {footerColumns.map((col) => (
          <div key={col.title}>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
              {col.title}
            </div>
            <ul className="space-y-2">
              {col.items.map((it) => (
                <li key={it.to}>
                  <Link
                    to={it.to}
                    className="rounded-sm text-sm text-white/65 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-4 focus-visible:ring-offset-brand-charcoal"
                  >
                    {it.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 px-5 py-5 text-xs text-white/45 sm:flex-row sm:items-center sm:px-8">
          <div>
            © {new Date().getFullYear()} {brand.name}. All rights reserved.
          </div>
          <div>Made for creators who still want the final cut in their hands.</div>
        </div>
      </div>
    </footer>
  );
}
