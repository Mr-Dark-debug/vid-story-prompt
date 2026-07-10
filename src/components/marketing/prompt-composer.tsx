import { useState } from "react";
import { Wand2 } from "lucide-react";

const examples = [
  {
    prompt: "Create a six-minute YouTube first cut. Keep the strongest explanations and remove repeated takes.",
    plan: [
      "Remove 22 pauses and 11 filler moments",
      "Prefer take 3 in 4 places",
      "Insert 6 B-roll shots from the roastery folder",
      "Add caption preset: Clean Editorial",
    ],
    duration: "12:04 → 06:10",
  },
  {
    prompt: "Use exterior shots as B-roll when I discuss arriving at the location.",
    plan: [
      "Detect \"arrival\" section using transcript",
      "Insert exterior clips at 01:08, 01:31, 02:12",
      "Lower dialogue by 2 dB during inserts",
    ],
    duration: "unchanged",
  },
  {
    prompt: "Remove filler words, but keep natural pauses.",
    plan: [
      "Remove 143 filler tokens",
      "Preserve pauses longer than 400 ms",
      "Skip corrections inside quoted speech",
    ],
    duration: "12:04 → 11:19",
  },
  {
    prompt: "Turn this interview into three vertical clips with different hooks.",
    plan: [
      "Rank 12 candidate hooks by strength",
      "Draft three 9:16 clips: 00:32 / 00:41 / 00:38",
      "Add hook captions and safe-area guides",
    ],
    duration: "3 × short-form",
  },
  {
    prompt: "Add clean captions and lower the music whenever someone speaks.",
    plan: [
      "Generate captions from transcript",
      "Apply Clean Editorial preset",
      "Duck music by 8 dB under dialogue",
    ],
    duration: "unchanged",
  },
  {
    prompt: "Make the pacing calmer and restore the section about pricing.",
    plan: [
      "Extend inter-clip beats by 180 ms",
      "Undo removal of 04:18 – 04:52 (pricing)",
      "Rebalance chapters",
    ],
    duration: "06:10 → 07:04",
  },
];

export function PromptComposer() {
  const [i, setI] = useState(0);
  const active = examples[i];
  return (
    <div className="grid gap-6 md:grid-cols-[1.1fr_1fr]">
      <div>
        <div className="rounded-2xl border border-line bg-surface-panel p-2 shadow-sm">
          <div className="flex items-start gap-2 rounded-xl bg-surface-page px-3 py-3">
            <Wand2 className="mt-1 h-4 w-4 shrink-0 text-ember" />
            <div className="text-sm leading-relaxed text-ink">{active.prompt}</div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {examples.map((e, idx) => (
            <button
              key={idx}
              onClick={() => setI(idx)}
              className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                idx === i
                  ? "border-ink bg-ink text-surface-page"
                  : "border-line bg-surface-panel text-ink-soft hover:text-ink"
              }`}
            >
              Example {idx + 1}
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-line bg-surface-raised p-4">
        <div className="mb-2 flex items-center justify-between text-[11px] font-medium uppercase tracking-widest text-ink-mute">
          <span>Proposed plan</span>
          <span className="rounded bg-surface-sunken px-1.5 py-0.5 normal-case text-ink">
            {active.duration}
          </span>
        </div>
        <ul className="space-y-1.5">
          {active.plan.map((step) => (
            <li
              key={step}
              className="rounded-md border border-line bg-surface-panel px-3 py-2 text-sm text-ink"
            >
              {step}
            </li>
          ))}
        </ul>
        <div className="mt-3 text-[12px] text-ink-mute">
          You accept, edit or reject each step before anything changes.
        </div>
      </div>
    </div>
  );
}