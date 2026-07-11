import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, Film, Music, Image as ImageIcon, Subtitles } from "lucide-react";
import { loadProjects, type MockProject, type MockAsset } from "@/mock/seed";
import { StatusDot } from "@/components/primitives/status-dot";
import { EmptyState } from "@/components/primitives/empty-state";

export const Route = createFileRoute("/_authenticated/app/projects/$projectId/media")({
  component: MediaPage,
});

const iconFor: Record<MockAsset["kind"], typeof Film> = {
  video: Film,
  audio: Music,
  image: ImageIcon,
  subtitle: Subtitles,
};

function MediaPage() {
  const { projectId } = useParams({ from: "/_authenticated/app/projects/$projectId/media" });
  const [project, setProject] = useState<MockProject | null>(null);
  const [q, setQ] = useState("");
  const [role, setRole] = useState<string>("all");
  useEffect(() => {
    setProject(loadProjects().find((p) => p.id === projectId) ?? null);
  }, [projectId]);
  const filtered = useMemo(() => {
    if (!project) return [];
    return project.assets.filter((a) => {
      if (role !== "all" && a.role !== role) return false;
      if (!q) return true;
      const hay = [a.name, a.speaker, a.scene, a.transcriptExcerpt, ...(a.tags ?? [])].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  }, [project, q, role]);
  if (!project) return null;
  const roles = ["all", ...Array.from(new Set(project.assets.map((a) => a.role)))];
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-mute" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by speaker, scene, tag, or transcript…"
            className="w-full rounded-md border border-line bg-surface-panel py-2 pl-8 pr-3 text-sm text-ink outline-none focus:border-ember"
          />
        </div>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="rounded-md border border-line bg-surface-panel px-3 py-2 text-sm text-ink"
        >
          {roles.map((r) => (
            <option key={r} value={r}>{r === "all" ? "All roles" : r}</option>
          ))}
        </select>
        <StatusDot variant="demo">Natural-language search · simulated</StatusDot>
      </div>
      {filtered.length === 0 ? (
        <EmptyState title="No matching media" body="Try a different search or role filter." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => {
            const Icon = iconFor[a.kind];
            return (
              <li key={a.id} className="rounded-xl border border-line bg-surface-panel p-4">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-ember" />
                  <div className="truncate text-sm font-medium text-ink">{a.name}</div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1 text-[11px] text-ink-mute">
                  <span className="rounded bg-surface-sunken px-1.5 py-0.5">{a.role}</span>
                  {a.speaker && <span className="rounded bg-surface-sunken px-1.5 py-0.5">{a.speaker}</span>}
                  {a.scene && <span className="rounded bg-surface-sunken px-1.5 py-0.5">{a.scene}</span>}
                  {a.durationSec && <span>{Math.round(a.durationSec)}s</span>}
                </div>
                {a.transcriptExcerpt && (
                  <p className="mt-2 line-clamp-2 text-[12.5px] italic text-ink-soft">"{a.transcriptExcerpt}"</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}