import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { loadProjects, type MockProject, type TranscriptWord } from "@/mock/seed";
import { StatusDot } from "@/components/primitives/status-dot";
import { Callout } from "@/components/primitives/section";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/projects/$projectId/transcript")({
  component: TranscriptPage,
});

function TranscriptPage() {
  const { projectId } = useParams({ from: "/_authenticated/app/projects/$projectId/transcript" });
  const [project, setProject] = useState<MockProject | null>(null);
  const [showExplainer, setShowExplainer] = useState(true);
  const [words, setWords] = useState<TranscriptWord[]>([]);
  useEffect(() => {
    const p = loadProjects().find((x) => x.id === projectId) ?? null;
    setProject(p);
    setWords(p?.transcript ?? []);
  }, [projectId]);
  const byLine = useMemo(() => {
    const groups: TranscriptWord[][] = [];
    let cur: TranscriptWord[] = [];
    for (const w of words) {
      cur.push(w);
      if (w.silence) {
        groups.push(cur);
        cur = [];
      }
    }
    if (cur.length) groups.push(cur);
    return groups;
  }, [words]);
  if (!project) return null;
  const kept = words.filter((w) => !w.excluded && !w.silence).length;
  const excluded = words.filter((w) => w.excluded && !w.silence).length;
  function toggleExclude(id: string) {
    setWords((ws) => ws.map((w) => (w.id === id ? { ...w, excluded: !w.excluded } : w)));
  }
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
      <div className="space-y-3">
        {showExplainer && (
          <Callout tone="info" title="Editing text vs excluding from the timeline">
            Click a word to <strong>exclude</strong> it from the exported edit. To rewrite spoken text, use the Edit text mode (coming soon).{" "}
            <button className="underline" onClick={() => setShowExplainer(false)}>Got it</button>
          </Callout>
        )}
        <div className="rounded-2xl border border-line bg-surface-panel p-5 leading-8">
          {byLine.map((line, i) => {
            const speaker = line[0]?.speaker ?? "";
            return (
              <div key={i} className="mb-4">
                <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-ink-mute">{speaker}</div>
                <p className="flex flex-wrap gap-x-1 gap-y-1">
                  {line.map((w) =>
                    w.silence ? (
                      <span key={w.id} className="text-ink-mute">·</span>
                    ) : (
                      <button
                        key={w.id}
                        onClick={() => toggleExclude(w.id)}
                        className={cn(
                          "rounded px-1 text-sm",
                          w.excluded ? "text-ink-mute line-through" : "text-ink hover:bg-surface-sunken",
                          w.filler && "italic",
                        )}
                      >
                        {w.text}
                      </button>
                    ),
                  )}
                </p>
              </div>
            );
          })}
        </div>
      </div>
      <aside className="space-y-3">
        <div className="rounded-xl border border-line bg-surface-panel p-4 text-sm">
          <div className="font-display text-ink">Transcript summary</div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[12px] text-ink-soft">
            <span>Kept</span><span className="text-right text-ink">{kept}</span>
            <span>Excluded</span><span className="text-right text-ink">{excluded}</span>
            <span>Speakers</span><span className="text-right text-ink">{Array.from(new Set(words.map((w) => w.speaker))).length}</span>
          </div>
        </div>
        <StatusDot variant="demo">Transcript edits apply on save</StatusDot>
      </aside>
    </div>
  );
}