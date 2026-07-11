import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Undo2, Redo2, Save, Play, Pause } from "lucide-react";
import { loadProjects, type MockProject } from "@/mock/seed";
import { useTimeline } from "@/domain/timeline/store";
import { TimelineView } from "@/components/editor/timeline";
import { AIPanel } from "@/components/editor/ai-panel";
import { StatusDot } from "@/components/primitives/status-dot";
import type { Clip } from "@/domain/timeline/types";

export const Route = createFileRoute("/_authenticated/app/projects/$projectId/editor")({
  head: () => ({ meta: [{ title: "Editor — Vidrial" }] }),
  component: Editor,
});

function initialClipsFor(project: MockProject): Clip[] {
  // Seed a small starter timeline from assets so the editor is visually alive.
  const clips: Clip[] = [];
  const interview = project.assets.find((a) => a.role === "interview");
  const broll = project.assets.filter((a) => a.role === "b-roll").slice(0, 3);
  if (interview) {
    clips.push({
      id: "seed_i1",
      assetId: interview.id,
      name: "Interview · opener",
      trackId: "vt1",
      start: 0,
      in: 12,
      out: 20,
      kind: "video",
    });
  }
  let t = 8;
  for (const a of broll) {
    clips.push({
      id: `seed_${a.id}`,
      assetId: a.id,
      name: a.name,
      trackId: "vt2",
      start: t,
      in: 0,
      out: 3.5,
      kind: "video",
    });
    t += 4;
  }
  clips.push({
    id: "seed_music",
    assetId: "a9",
    name: "Warm acoustic loop",
    trackId: "at2",
    start: 0,
    in: 0,
    out: 22,
    kind: "audio",
  });
  return clips;
}

function Editor() {
  const { projectId } = useParams({ from: "/_authenticated/app/projects/$projectId/editor" });
  const [project, setProject] = useState<MockProject | null>(null);
  const reset = useTimeline((s) => s.reset);
  const undo = useTimeline((s) => s.undo);
  const redo = useTimeline((s) => s.redo);
  const canUndo = useTimeline((s) => s.canUndo());
  const canRedo = useTimeline((s) => s.canRedo());
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const p = loadProjects().find((x) => x.id === projectId) ?? null;
    setProject(p);
    if (p) reset({ clips: initialClipsFor(p) });
  }, [projectId, reset]);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const s = useTimeline.getState();
      const next = s.playhead + 0.1;
      if (next > s.duration) {
        setPlaying(false);
        return;
      }
      s.setPlayhead(next);
    }, 100);
    return () => clearInterval(id);
  }, [playing]);

  if (!project) return null;

  return (
    <div className="-mx-5 -my-2 flex h-[calc(100dvh-160px)] flex-col overflow-hidden rounded-2xl border border-line bg-surface-panel sm:-mx-8">
      {/* Topbar */}
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <div className="flex items-center gap-2 text-sm">
          <button
            disabled={!canUndo}
            onClick={undo}
            className="rounded p-1.5 text-ink-soft hover:bg-surface-sunken disabled:opacity-40"
            aria-label="Undo"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            disabled={!canRedo}
            onClick={redo}
            className="rounded p-1.5 text-ink-soft hover:bg-surface-sunken disabled:opacity-40"
            aria-label="Redo"
          >
            <Redo2 className="h-4 w-4" />
          </button>
          <span className="text-ink-mute">·</span>
          <StatusDot variant="demo">Local · not saved to cloud</StatusDot>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPlaying((p) => !p)}
            className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-page px-2.5 py-1.5 text-sm"
          >
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />} {playing ? "Pause" : "Play"}
          </button>
          <button className="inline-flex items-center gap-1 rounded-md bg-ink px-2.5 py-1.5 text-sm font-medium text-surface-page">
            <Save className="h-3.5 w-3.5" /> Save
          </button>
        </div>
      </div>

      {/* Middle: preview + AI */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1.6fr_1fr]">
        <div className="flex items-center justify-center border-b border-line bg-surface-sunken lg:border-b-0 lg:border-r">
          <div className="w-full max-w-2xl px-6 py-6">
            <div className="aspect-video overflow-hidden rounded-lg border border-line bg-ink shadow-lg">
              <div className="flex h-full items-center justify-center text-surface-page/60">
                Preview · {project.aspect} · {useTimeline.getState().playhead.toFixed(1)}s
              </div>
            </div>
            <p className="mt-3 text-center text-[11px] text-ink-mute">
              Preview is a placeholder — real playback ships with Cloud.
            </p>
          </div>
        </div>
        <div className="min-h-[240px] overflow-hidden">
          <AIPanel project={project} />
        </div>
      </div>

      {/* Timeline */}
      <div className="h-[280px] shrink-0">
        <TimelineView />
      </div>
    </div>
  );
}