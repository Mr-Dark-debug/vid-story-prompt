import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { StatusDot } from "@/components/primitives/status-dot";
import { cn } from "@/lib/utils";
import { getProject } from "@/services/projects/server";

export const Route = createFileRoute("/_authenticated/app/projects/$projectId")({
  loader: ({ params }) => getProject({ data: { projectId: params.projectId } }),
  pendingComponent: () => (
    <div
      className="h-72 animate-pulse rounded-2xl bg-surface-sunken motion-reduce:animate-none"
      aria-label="Loading project"
      aria-busy="true"
    />
  ),
  component: ProjectLayout,
});

const tabs = [
  { suffix: "", label: "Overview" },
  { suffix: "/editor", label: "Editor" },
  { suffix: "/media", label: "Media" },
  { suffix: "/transcript", label: "Transcript" },
  { suffix: "/versions", label: "Versions" },
  { suffix: "/exports", label: "Exports" },
] as const;

function ProjectLayout() {
  const { project, assets } = Route.useLoaderData();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (
    <div className="min-w-0">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[.14em] text-ink-mute">Project</div>
          <h1 className="truncate font-display text-2xl text-ink sm:text-3xl">{project.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-ink-mute">
            <StatusDot variant={project.status === "in-progress" ? "info" : "muted"}>
              {project.status}
            </StatusDot>
            <span>· {project.aspect}</span>
            <span>· {assets.length} assets</span>
            <span>· Cloud saved</span>
          </div>
        </div>
      </div>
      <nav
        aria-label="Project sections"
        className="mb-6 flex max-w-full gap-1 overflow-x-auto border-b border-line"
      >
        {tabs.map((tab) => {
          const href = `/app/projects/${project.id}${tab.suffix}`;
          const active = pathname === href;
          return (
            <Link
              key={tab.label}
              to={href as "/app/projects/$projectId"}
              params={{ projectId: project.id }}
              activeProps={{ "aria-current": "page" }}
              className={cn(
                "min-h-11 shrink-0 border-b-2 px-3 py-2 text-sm text-ink-soft hover:text-ink",
                active ? "border-ember text-ink" : "border-transparent",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      <Outlet />
    </div>
  );
}
