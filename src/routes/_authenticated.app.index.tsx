import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Clock, FolderKanban, Scissors, UploadCloud } from "lucide-react";
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
  const assetCount = projects.reduce((total, project) => total + project.assetCount, 0);
  const completedJobs = jobs.filter(
    (job) => job.status === "ready" || job.status === "completed",
  ).length;
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
      <div className="mb-7 grid gap-3 sm:grid-cols-3">
        <SummaryCard
          icon={FolderKanban}
          label="Projects"
          value={projects.length}
          detail="In this workspace"
        />
        <SummaryCard
          icon={UploadCloud}
          label="Media assets"
          value={assetCount}
          detail="Across all projects"
        />
        <SummaryCard
          icon={Scissors}
          label="Ready clips"
          value={completedJobs}
          detail={`${jobs.length} clipping jobs total`}
        />
      </div>
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
            {projects.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-dashed border-line bg-surface-panel px-6 py-12 text-center">
                <FolderKanban className="mx-auto h-8 w-8 text-ink-mute" />
                <h3 className="mt-4 font-display text-lg text-ink">Create your first project</h3>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-ink-soft">
                  Bring authorised media into a private workspace and keep every edit explainable.
                </p>
                <Link
                  to="/app/projects/new"
                  className="mt-5 inline-flex min-h-10 items-center rounded-md bg-ink px-4 text-sm font-medium text-surface-page"
                >
                  New project
                </Link>
              </div>
            ) : null}
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
            <p className="text-sm text-ink-soft">{completedJobs} ready or completed</p>
            <Link to="/app/youtube-clipper" className="mt-4 inline-flex text-sm text-ember-ink">
              Open clipping jobs <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof FolderKanban;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface-panel p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-ink-soft">{label}</span>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-surface-sunken text-ember-ink">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-3 font-display text-2xl text-ink">{value}</div>
      <p className="mt-1 text-xs text-ink-mute">{detail}</p>
    </section>
  );
}
