import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Pause, Play, Redo2, Save, Undo2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AIPanel } from "@/components/editor/ai-panel";
import { TimelineView } from "@/components/editor/timeline";
import { Button } from "@/components/ui/button";
import { setTimelineSnapEnabled, useTimeline } from "@/domain/timeline/store";
import type { Clip } from "@/domain/timeline/types";
import { userFacingError } from "@/lib/user-facing-error";
import { getProject, saveProjectTimeline } from "@/services/projects/server";
import { getAccountPreferences } from "@/services/settings/server";

export const Route = createFileRoute("/_authenticated/app/projects/$projectId/editor")({
  head: () => ({ meta: [{ title: "Editor — Vidrial" }] }),
  loader: async ({ params }) => {
    const [projectData, preferences] = await Promise.all([
      getProject({ data: { projectId: params.projectId } }),
      getAccountPreferences(),
    ]);
    return { ...projectData, preferences };
  },
  component: Editor,
});

function Editor() {
  const { project, assets, preferences } = Route.useLoaderData();
  const router = useRouter();
  const reset = useTimeline((state) => state.reset);
  const undo = useTimeline((state) => state.undo);
  const redo = useTimeline((state) => state.redo);
  const canUndo = useTimeline((state) => state.canUndo());
  const canRedo = useTimeline((state) => state.canRedo());
  const playhead = useTimeline((state) => state.playhead);
  const [playing, setPlaying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const lastSaved = useRef("");
  const preview = assets.find((asset) => asset.previewUrl && asset.mime_type?.startsWith("video/"));

  useEffect(() => {
    const saved =
      project.timeline_json &&
      typeof project.timeline_json === "object" &&
      !Array.isArray(project.timeline_json)
        ? (project.timeline_json as { clips?: Clip[]; zoom?: number })
        : {};
    reset({
      clips: Array.isArray(saved.clips) ? saved.clips : [],
      zoom: typeof saved.zoom === "number" ? saved.zoom : undefined,
    });
    lastSaved.current = JSON.stringify({
      clips: Array.isArray(saved.clips) ? saved.clips : [],
      zoom: typeof saved.zoom === "number" ? saved.zoom : 40,
    });
  }, [project.id, project.timeline_json, reset]);

  useEffect(() => {
    setTimelineSnapEnabled(preferences.editor.snapToWords);
  }, [preferences.editor.snapToWords]);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      const state = useTimeline.getState();
      const next = state.playhead + 0.1;
      if (next > state.duration) {
        setPlaying(false);
        return;
      }
      state.setPlayhead(next);
    }, 100);
    return () => window.clearInterval(id);
  }, [playing]);

  const save = useCallback(async (automatic = false) => {
    const state = useTimeline.getState();
    const signature = JSON.stringify({ clips: state.clips, zoom: state.zoom });
    if (automatic && signature === lastSaved.current) return;
    if (!automatic) setSaving(true);
    if (!automatic) setMessage(null);
    try {
      const savedAt = new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      }).format(new Date());
      await saveProjectTimeline({
        data: {
          projectId: project.id,
          timeline: { clips: state.clips, playhead: state.playhead, zoom: state.zoom },
          label: `${automatic ? "Autosave" : "Manual save"} ${savedAt} UTC`,
          summary: `Saved ${state.clips.length} timeline clips.`,
          kind: "manual",
        },
      });
      lastSaved.current = signature;
      setMessage(automatic ? "Changes autosaved." : "Version saved securely.");
      if (!automatic) toast.success("Timeline version saved.");
      await router.invalidate();
    } catch (cause) {
      const friendly = userFacingError(cause, "The timeline could not be saved.");
      setMessage(friendly);
      if (!automatic) toast.error(friendly);
    } finally {
      if (!automatic) setSaving(false);
    }
  }, [project.id, router]);

  useEffect(() => {
    const seconds = preferences.editor.autosaveSeconds;
    if (!seconds) return;
    const id = window.setInterval(() => void save(true), seconds * 1000);
    return () => window.clearInterval(id);
  }, [preferences.editor.autosaveSeconds, save]);

  return (
    <div className="-mx-4 -my-2 flex min-h-[720px] flex-col overflow-hidden rounded-2xl border border-line bg-surface-panel sm:-mx-8 lg:h-[calc(100dvh-160px)] lg:min-h-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" disabled={!canUndo} onClick={undo} aria-label="Undo">
            <Undo2 />
          </Button>
          <Button size="icon" variant="ghost" disabled={!canRedo} onClick={redo} aria-label="Redo">
            <Redo2 />
          </Button>
          <span role="status" aria-live="polite" className="ml-2 text-xs text-ink-mute">
            {message ?? "Save a version to keep your timeline changes."}
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPlaying((value) => !value)}>
            {playing ? <Pause /> : <Play />}
            {playing ? "Pause" : "Play"}
          </Button>
          <Button onClick={() => void save()} loading={saving} loadingText="Saving…">
            <Save />
            Save version
          </Button>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1.6fr_1fr]">
        <div className="flex items-center justify-center border-b border-line bg-surface-sunken lg:border-b-0 lg:border-r">
          <div className="w-full max-w-2xl px-5 py-6">
            {preview ? (
              <video
                src={preview.previewUrl ?? undefined}
                controls
                preload={preferences.editor.lowResolutionPreview ? "metadata" : "auto"}
                className="aspect-video w-full rounded-lg bg-ink shadow-lg"
              />
            ) : (
              <div className="flex aspect-video items-center justify-center rounded-lg bg-ink px-5 text-center text-sm text-white/65">
                Upload project media to enable playback.
              </div>
            )}
            <p className="mt-3 text-center text-xs text-ink-mute">
              {project.aspect} · playhead {playhead.toFixed(1)}s · private signed preview
            </p>
          </div>
        </div>
        <div className="min-h-[320px] overflow-hidden">
          <AIPanel projectId={project.id} requireReview={preferences.editor.aiPlanPreview} />
        </div>
      </div>
      <div className="h-[280px] shrink-0">
        <TimelineView />
      </div>
    </div>
  );
}
