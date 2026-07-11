import { useState } from "react";
import { Sparkles, Check, X, Wand2 } from "lucide-react";
import { useTimeline } from "@/domain/timeline/store";
import { planFromPrompt } from "@/domain/timeline/planner";
import type { PlanOp } from "@/domain/timeline/types";

type PlanOpWithStatus = PlanOp & { status: "pending" | "accepted" | "rejected" };
import type { MockProject } from "@/mock/seed";
import { StatusDot } from "@/components/primitives/status-dot";

type PlanState = ReturnType<typeof planFromPrompt> | null;

const suggestions = [
  "Cut a warm 90-second first cut with music and captions.",
  "Make a 30-second short-form vertical version.",
  "Remove all filler words and long pauses.",
  "Insert b-roll during the second half of the interview.",
];

export function AIPanel({ project }: { project: MockProject }) {
  const [prompt, setPrompt] = useState("");
  const [plan, setPlan] = useState<PlanState>(null);
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const applyOps = useTimeline((s) => s.applyOps);

  function submit(text?: string) {
    const p = (text ?? prompt).trim();
    if (!p) return;
    const newPlan = planFromPrompt(p, project);
    setPlan(newPlan);
    setMessages((m) => [
      ...m,
      { role: "user", text: p },
      { role: "ai", text: `I drafted ${newPlan.ops.length} operations for “${p}”. Review each before applying.` },
    ]);
    setPrompt("");
  }

  function toggle(id: string, status: "accepted" | "rejected") {
    if (!plan) return;
    const ops = plan.ops.map((o) => (o.id === id ? { ...o, status } : o)) as PlanOpWithStatus[];
    setPlan({ ...plan, ops });
  }

  function acceptAll() {
    if (!plan) return;
    const nextOps = plan.ops.map((o) =>
      o.status === "rejected" ? o : ({ ...o, status: "accepted" } as PlanOpWithStatus),
    ) as PlanOpWithStatus[];
    applyOps(nextOps.filter((o) => o.status === "accepted") as PlanOp[]);
    setPlan({ ...plan, ops: nextOps });
    setMessages((m) => [
      ...m,
      { role: "ai", text: `Applied ${nextOps.filter((o) => o.status === "accepted").length} operations.` },
    ]);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-line px-4 py-3">
        <div className="flex items-center gap-2 font-display text-sm text-ink">
          <Sparkles className="h-4 w-4 text-ember" /> AI editor
        </div>
        <p className="mt-1 text-[11px] text-ink-mute">Ask for an edit. Review the plan before it happens.</p>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-wider text-ink-mute">Try</div>
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => submit(s)}
                className="block w-full rounded-md border border-line bg-surface-page px-3 py-2 text-left text-[12.5px] text-ink-soft hover:border-ember hover:text-ink"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-ink px-3 py-2 text-[13px] text-surface-page"
                : "max-w-[90%] rounded-2xl rounded-tl-sm bg-surface-sunken px-3 py-2 text-[13px] text-ink"
            }
          >
            {m.text}
          </div>
        ))}
        {plan && (
          <div className="rounded-xl border border-line bg-surface-page p-3">
            <div className="mb-2 flex items-center justify-between text-[11px] text-ink-mute">
              <span>{plan.summary}</span>
              <StatusDot variant="demo">~{plan.estimatedMinutes}m usage</StatusDot>
            </div>
            <ul className="space-y-1.5">
              {plan.ops.map((op) => (
                <li
                  key={op.id}
                  className="flex items-start justify-between gap-2 rounded-md border border-line bg-surface-panel px-2 py-1.5 text-[12px]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-ink">{op.note ?? op.type}</div>
                    <div className="text-[10px] uppercase tracking-wider text-ink-mute">{op.type}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {op.status === "pending" ? (
                      <>
                        <button
                          onClick={() => toggle(op.id, "rejected")}
                          aria-label="Reject"
                          className="rounded p-1 text-ink-mute hover:bg-surface-sunken"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => toggle(op.id, "accepted")}
                          aria-label="Accept"
                          className="rounded bg-ink p-1 text-surface-page"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <StatusDot variant={op.status === "accepted" ? "success" : "muted"}>
                        {op.status}
                      </StatusDot>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {plan.warnings?.map((w) => (
              <div key={w} className="mt-2 rounded-md border border-warning/40 bg-warning/10 px-2 py-1.5 text-[11px] text-ink">
                {w}
              </div>
            ))}
            <div className="mt-3 flex items-center justify-between gap-2">
              <button
                onClick={() => setPlan(null)}
                className="rounded-md border border-line bg-surface-panel px-2.5 py-1 text-[11px] text-ink-soft"
              >
                Dismiss plan
              </button>
              <button
                onClick={acceptAll}
                className="inline-flex items-center gap-1 rounded-md bg-ember px-2.5 py-1 text-[11px] font-medium text-surface-page"
              >
                <Wand2 className="h-3 w-3" /> Apply accepted
              </button>
            </div>
          </div>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="border-t border-line p-3"
      >
        <div className="flex gap-2">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe an edit…"
            className="flex-1 rounded-md border border-line bg-surface-page px-3 py-2 text-sm text-ink outline-none focus:border-ember"
          />
          <button className="rounded-md bg-ink px-3 py-2 text-sm font-medium text-surface-page">Send</button>
        </div>
      </form>
    </div>
  );
}