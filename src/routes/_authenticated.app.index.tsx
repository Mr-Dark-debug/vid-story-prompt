import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Clock, FolderKanban, Scissors } from "lucide-react";
import { AppPageHeader } from "@/components/app/layout";
import { StatusDot } from "@/components/primitives/status-dot";
import { UsageMeter } from "@/components/primitives/usage-meter";
import { listProjects } from "@/services/projects/server";
import { listClipJobs } from "@/services/clipping/server";
import { getUsageOverview } from "@/services/usage/server";
import { getCurrentSession } from "@/services/auth/server";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({ meta: [{ title: "Overview — Vidrial" }] }),
  loader: async () => {
    const [projects, jobs, usage, user] = await Promise.all([
      listProjects(),
      listClipJobs(),
      getUsageOverview(),
      getCurrentSession(),
    ]);
    return { projects, jobs, usage, user };
  },
  component: Dashboard,
});
function Dashboard() {
  const { projects, jobs, usage, user } = Route.useLoaderData();
  const used = Math.ceil(
    (Number(usage.period.source_seconds_committed) + Number(usage.period.source_seconds_reserved)) /
      60,
  );
  const limit = Math.ceil(Number(usage.period.source_seconds_limit) / 60);
  return (
    <div>
      <AppPageHeader
        eyebrow={`Welcome back${user?.name ? `, ${user.name.split(" ")[0]}` : ""}`}
        title="Your video workspace"
        description="Continue a project or create AI clips from authorised media."
        actions={
          <Link
            to="/app/projects/new"
            className="inline-flex min-h-11 items-center rounded-md bg-ink px-4 text-sm font-medium text-surface-page"
          >
            New project
          </Link>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg text-ink">Recent projects</h2>
            <Link to="/app/projects" className="text-sm text-ember-ink">
              All projects <ArrowRight className="inline h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {projects.slice(0, 4).map((project) => (
              <Link
                key={project.id}
                to="/app/projects/$projectId"
                params={{ projectId: project.id }}
                className="group rounded-2xl border border-line bg-surface-panel p-4 hover:border-line-strong"
              >
                <div className="flex aspect-video items-center justify-center rounded-xl bg-surface-sunken">
                  <FolderKanban className="h-8 w-8 text-ink-mute group-hover:text-ember" />
                </div>
                <div className="mt-3 truncate font-display text-base text-ink">{project.name}</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-ink-mute">
                  <StatusDot variant={project.status === "in-progress" ? "info" : "muted"}>
                    {project.status}
                  </StatusDot>
                  <span>{project.assetCount} assets</span>
                </div>
              </Link>
            ))}
            <Link
              to="/app/projects/new"
              className="flex min-h-[180px] items-center justify-center rounded-2xl border border-dashed border-line bg-surface-panel p-6 text-sm text-ink-soft hover:border-ember"
            >
              + Create your first project
            </Link>
          </div>
        </section>
        <aside className="space-y-4">
          <section className="rounded-2xl border border-line bg-surface-panel p-5">
            <h2 className="flex items-center gap-2 text-sm font-medium text-ink">
              <Clock className="h-4 w-4 text-ember" />
              Usage this month
            </h2>
            <div className="mt-4">
              <UsageMeter label="Source minutes" used={used} total={limit} unit="min" />
            </div>
            <Link to="/app/usage" className="mt-4 inline-flex text-sm text-ember-ink">
              Usage detail <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </section>
          <section className="rounded-2xl border border-line bg-surface-panel p-5">
            <h2 className="flex items-center gap-2 text-sm font-medium text-ink">
              <Scissors className="h-4 w-4 text-teal" />
              Clipping jobs
            </h2>
            <div className="mt-3 text-3xl font-display text-ink">{jobs.length}</div>
            <p className="text-sm text-ink-soft">
              {jobs.filter((job) => job.status === "ready" || job.status === "completed").length}{" "}
              ready or completed
            </p>
            <Link to="/app/youtube-clipper" className="mt-4 inline-flex text-sm text-ember-ink">
              Open clipping jobs <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
