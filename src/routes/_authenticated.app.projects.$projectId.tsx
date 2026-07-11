import { createFileRoute, Link, Outlet, useParams, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { loadProjects, type MockProject } from "@/mock/seed";
import { StatusDot } from "@/components/primitives/status-dot";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/projects/$projectId")({
  component: ProjectLayout,
});

const tabs: { to: string; label: string; end?: boolean }[] = [
  { to: "/app/projects/$projectId", label: "Overview", end: true },
  { to: "/app/projects/$projectId/editor", label: "Editor" },
  { to: "/app/projects/$projectId/media", label: "Media" },
  { to: "/app/projects/$projectId/transcript", label: "Transcript" },
  { to: "/app/projects/$projectId/versions", label: "Versions" },
  { to: "/app/projects/$projectId/exports", label: "Exports" },
];

function ProjectLayout() {
  const { projectId } = useParams({ from: "/_authenticated/app/projects/$projectId" });
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [project, setProject] = useState<MockProject | null>(null);
  useEffect(() => {
    const found = loadProjects().find((p) => p.id === projectId);
    setProject(found ?? null);
  }, [projectId]);

  if (!project) {
    return (
      <div className="rounded-2xl border border-line bg-surface-panel p-8 text-center">
        <div className="font-display text-lg text-ink">Project not found</div>
        <p className="mt-1 text-sm text-ink-soft">It may have been deleted from this browser.</p>
        <Link to="/app/projects" className="mt-4 inline-block text-sm text-ember-ink">All projects</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-ink-mute">Project</div>
          <h1 className="font-display text-2xl text-ink sm:text-3xl">{project.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-ink-mute">
            <StatusDot variant={project.status === "in-progress" ? "info" : "muted"}>{project.status.replace("-", " ")}</StatusDot>
            <span>· {project.aspect}</span>
            <span>· {project.assets.length} assets</span>
            <span>· {Math.round(project.durationSec)}s</span>
          </div>
        </div>
      </div>
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((t) => {
          const isActive = t.end ? pathname === `/app/projects/${projectId}` : pathname.startsWith(t.to.replace("$projectId", projectId));
          return (
            <Link
              key={t.label}
              // @ts-expect-error dynamic route path
              to={t.to}
              params={{ projectId }}
              className={cn(
                "border-b-2 px-3 py-2 text-sm text-ink-soft hover:text-ink",
                isActive ? "border-ember text-ink" : "border-transparent",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
      <Outlet />
    </div>
  );
}