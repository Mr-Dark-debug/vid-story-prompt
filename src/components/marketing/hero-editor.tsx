/**
 * Interactive-ish product visual for the hero:
 * media list + preview + AI chat + proposed edit plan + timeline strip.
 * Non-functional (no state); it demonstrates layout and language.
 */
import { Play, Wand2, Scissors, Music4, Captions, Sparkles } from "lucide-react";
import { StatusDot } from "@/components/primitives/status-dot";

const media = [
  { name: "roastery-arrival.mov", meta: "01:24 · 4K", role: "A-roll" },
  { name: "grinder-closeup.mov", meta: "00:38 · 4K", role: "B-roll" },
  { name: "founder-interview.mov", meta: "12:04 · 1080p", role: "A-roll" },
  { name: "market-street.mov", meta: "00:52 · 4K", role: "B-roll" },
  { name: "warm-pad.wav", meta: "03:00", role: "Music" },
];

const ops = [
  { icon: Scissors, label: "Remove 14 long pauses", detail: "00:00 → end" },
  { icon: Wand2, label: "Use take 3 instead of take 1", detail: "02:14 – 02:41" },
  { icon: Sparkles, label: "Insert grinder-closeup.mov", detail: "01:08 – 01:16" },
  { icon: Captions, label: "Add captions · Clean Editorial", detail: "Whole timeline" },
  { icon: Music4, label: "Duck music by 8 dB under dialogue", detail: "Audio track 2" },
];

export function HeroEditor() {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10 rounded-[28px] bg-gradient-to-br from-ember-soft/60 via-transparent to-teal-soft/40 blur-2xl" />
      <div className="grid grid-cols-1 gap-3 rounded-[22px] border border-line bg-surface-panel p-3 shadow-[0_30px_80px_-30px_rgba(30,20,10,0.25)] md:grid-cols-[220px_1fr_260px]">
        {/* Media library */}
        <div className="rounded-2xl border border-line bg-surface-raised p-3">
          <div className="mb-2 flex items-center justify-between text-[11px] font-medium uppercase tracking-widest text-ink-mute">
            <span>Media</span>
            <StatusDot variant="demo">Demo</StatusDot>
          </div>
          <ul className="space-y-1.5">
            {media.map((m) => (
              <li
                key={m.name}
                className="rounded-lg border border-line/70 bg-surface-panel px-2 py-2 text-[12px]"
              >
                <div className="truncate font-medium text-ink">{m.name}</div>
                <div className="mt-0.5 flex items-center justify-between text-ink-mute">
                  <span className="truncate">{m.meta}</span>
                  <span className="ml-2 shrink-0 rounded bg-surface-sunken px-1.5 py-0.5 text-[10px]">
                    {m.role}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Preview + timeline */}
        <div className="flex flex-col gap-3">
          <div className="relative aspect-video overflow-hidden rounded-2xl bg-gradient-to-br from-ink to-ember-ink">
            <div className="absolute inset-0 opacity-40 [background:radial-gradient(circle_at_30%_30%,#f7c4a5,transparent_50%),radial-gradient(circle_at_70%_60%,#a8d8d2,transparent_45%)]" />
            <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 border-t border-white/10 bg-black/25 px-4 py-2.5 text-[12px] text-white/90 backdrop-blur">
              <button className="grid h-7 w-7 place-items-center rounded-full bg-white text-ink">
                <Play className="h-3.5 w-3.5" />
              </button>
              <span className="tabular-nums">00:34 / 06:12</span>
              <div className="ml-2 h-1 flex-1 overflow-hidden rounded-full bg-white/15">
                <div className="h-full w-[36%] bg-white/85" />
              </div>
              <span className="hidden text-white/70 sm:inline">16:9</span>
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-surface-raised p-3">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-widest text-ink-mute">
              Timeline
              <span className="rounded bg-surface-sunken px-1.5 py-0.5 normal-case text-ink">v3 · 06:12</span>
            </div>
            <div className="space-y-1.5">
              <TimelineRow tint="video" segments={[24, 12, 30, 18, 16]} />
              <TimelineRow tint="video" segments={[8, 22, 10, 40, 20]} thin />
              <TimelineRow tint="audio" segments={[100]} audio />
              <TimelineRow tint="caption" segments={[15, 20, 25, 20, 20]} thin />
            </div>
          </div>
        </div>

        {/* AI panel */}
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl border border-line bg-surface-raised p-3">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-widest text-ink-mute">
              <Wand2 className="h-3 w-3 text-ember" /> AI editor
            </div>
            <div className="rounded-lg border border-line bg-surface-panel px-3 py-2 text-[12.5px] leading-snug text-ink">
              Create a six-minute first cut. Keep the strongest explanations,
              remove pauses, add subtle captions.
            </div>
            <div className="mt-3 rounded-lg border border-ember/25 bg-ember-soft/40 px-3 py-2">
              <div className="flex items-center justify-between text-[11px] text-ember-ink">
                <span className="font-medium">Proposed plan · 12:04 → 06:12</span>
                <span className="tabular-nums">−5:52</span>
              </div>
              <ul className="mt-2 space-y-1.5">
                {ops.map((o) => (
                  <li
                    key={o.label}
                    className="flex items-start gap-2 rounded-md bg-surface-panel px-2 py-1.5 text-[12px] ring-1 ring-inset ring-line"
                  >
                    <o.icon className="mt-0.5 h-3.5 w-3.5 text-ember" />
                    <div className="min-w-0">
                      <div className="truncate text-ink">{o.label}</div>
                      <div className="truncate text-[11px] text-ink-mute">{o.detail}</div>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-2.5 flex gap-1.5">
                <button className="flex-1 rounded-md bg-ink px-2 py-1.5 text-[12px] font-medium text-surface-page">
                  Accept all
                </button>
                <button className="rounded-md border border-line bg-surface-panel px-2 py-1.5 text-[12px] text-ink">
                  Pick some
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineRow({
  tint,
  segments,
  thin,
  audio,
}: {
  tint: "video" | "audio" | "caption";
  segments: number[];
  thin?: boolean;
  audio?: boolean;
}) {
  const bg = {
    video: "bg-timeline-video/70",
    audio: "bg-timeline-audio/50",
    caption: "bg-timeline-caption/70",
  }[tint];
  return (
    <div className={`flex items-stretch gap-[3px] ${thin ? "h-3" : "h-6"}`}>
      {segments.map((w, i) => (
        <div
          key={i}
          className={`relative overflow-hidden rounded-[3px] ring-1 ring-inset ring-line-strong ${bg}`}
          style={{ flex: `${w} 0 0` }}
        >
          {audio && (
            <div className="absolute inset-0 flex items-center gap-[2px] px-1.5">
              {Array.from({ length: 40 }).map((_, j) => (
                <span
                  key={j}
                  className="w-[2px] rounded-full bg-teal/70"
                  style={{ height: `${20 + ((i + j) * 17) % 60}%` }}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}