import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { loadProjects, type MockProject } from "@/mock/seed";
import { StatusDot } from "@/components/primitives/status-dot";
import { History, Sparkles, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/projects/$projectId/versions")({
  component: VersionsPage,
});

function VersionsPage() {
  const { projectId } = useParams({ from: "/_authenticated/app/projects/$projectId/versions" });
  const [project, setProject] = useState<MockProject | null>(null);
  useEffect(() => {
    setProject(loadProjects().find((p) => p.id === projectId) ?? null);
  }, [projectId]);
  if (!project) return null;
  return (
    <ol className="space-y-3">
      {[...project.versions].reverse().map((v, i, arr) => (
        <li key={v.id} className="rounded-2xl border border-line bg-surface-panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {v.kind === "ai" ? (
                <Sparkles className="h-4 w-4 text-ember" />
              ) : (
                <History className="h-4 w-4 text-ink-mute" />
              )}
              <span className="font-display text-base text-ink">{v.label}</span>
              {i === 0 && <StatusDot variant="success">current</StatusDot>}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-ink-mute">
              <span>{new Date(v.createdAt).toLocaleString()}</span>
              {i > 0 && (
                <button className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-page px-2 py-1 text-ink-soft hover:text-ink">
                  <RotateCcw className="h-3 w-3" /> Restore
                </button>
              )}
            </div>
          </div>
          <p className="mt-2 text-sm text-ink-soft">{v.summary}</p>
          {i < arr.length - 1 && (
            <div className="mt-3 grid grid-cols-3 gap-3 text-[11px] text-ink-mute">
              <span>Duration Δ +{(Math.random() * 8).toFixed(1)}s</span>
              <span>Added {Math.floor(Math.random() * 6)} clips</span>
              <span>Removed {Math.floor(Math.random() * 4)} clips</span>
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}