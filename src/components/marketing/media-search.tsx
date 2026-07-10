import { Search } from "lucide-react";

const results = [
  { name: "roastery-exterior-04.mov", meta: "0:22 · sunset, no people", tags: ["exterior", "sunset"], conf: 0.94 },
  { name: "cart-street-golden.mov", meta: "0:14 · outdoor, warm light", tags: ["exterior", "b-roll"], conf: 0.88 },
  { name: "sign-lit-close.mov", meta: "0:08 · storefront, dusk", tags: ["exterior"], conf: 0.82 },
];

export function MediaSearchDemo() {
  return (
    <div className="rounded-2xl border border-line bg-surface-panel p-4 shadow-sm">
      <label className="flex items-center gap-2 rounded-xl border border-line bg-surface-page px-3 py-2.5">
        <Search className="h-4 w-4 text-ink-mute" />
        <span className="text-sm text-ink">sunset exterior with no people</span>
      </label>
      <ul className="mt-3 grid gap-2 sm:grid-cols-3">
        {results.map((r) => (
          <li key={r.name} className="overflow-hidden rounded-xl border border-line bg-surface-raised">
            <div className="aspect-video bg-gradient-to-br from-ember-soft to-timeline-audio/60" />
            <div className="p-2.5">
              <div className="truncate text-[13px] font-medium text-ink">{r.name}</div>
              <div className="mt-0.5 text-[11px] text-ink-mute">{r.meta}</div>
              <div className="mt-1.5 flex items-center justify-between text-[11px]">
                <div className="flex gap-1">
                  {r.tags.map((t) => (
                    <span key={t} className="rounded bg-surface-sunken px-1.5 py-0.5 text-ink-soft">
                      {t}
                    </span>
                  ))}
                </div>
                <span className="tabular-nums text-ink-mute">{Math.round(r.conf * 100)}%</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}