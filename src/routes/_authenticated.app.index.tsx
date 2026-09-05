import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Scissors } from "lucide-react";
import { AppPageHeader } from "@/components/app/layout";
import { UsageMeter } from "@/components/primitives/usage-meter";
import { listClipJobs } from "@/services/clipping/server";
import { getUsageOverview } from "@/services/usage/server";
import { getCurrentSession } from "@/services/auth/server";
export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({ meta: [{ title: "Clipping overview — Vidrial" }] }),
  loader: async () => {
    const [jobs, usage, user] = await Promise.all([
      listClipJobs(),
      getUsageOverview(),
      getCurrentSession(),
    ]);
    return { jobs, usage, user };
  },
  component: Dashboard,
});
function Dashboard() {
  const { jobs, usage, user } = Route.useLoaderData();
  const used = Math.ceil(
    (Number(usage.period.source_seconds_committed) + Number(usage.period.source_seconds_reserved)) /
      60,
  );
  const limit = Math.ceil(Number(usage.period.source_seconds_limit) / 60);
  return (
    <div>
      <AppPageHeader
        eyebrow={`Welcome back${user?.name ? ", " + user.name.split(" ")[0] : ""}`}
        title="Your clipping workspace"
        description="Turn authorised videos into short clips. Follow jobs, review results and download exports."
        actions={
          <Link
            to="/app/youtube-clipper/new"
            className="inline-flex min-h-11 items-center rounded-lg bg-ink px-4 text-sm font-medium text-surface-page"
          >
            New clipping job
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl text-ink">Recent clipping jobs</h2>
            <Link to="/app/youtube-clipper" className="text-sm text-ember-ink">
              All jobs <ArrowRight className="inline h-4 w-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {jobs.slice(0, 6).map((job) => (
              <Link
                key={job.id}
                to="/app/youtube-clipper/jobs/$jobId"
                params={{ jobId: job.id }}
                className="flex min-w-0 items-center justify-between gap-4 rounded-xl border border-line bg-surface-panel p-5 hover:border-line-strong"
              >
                <div className="min-w-0">
                  <h3 className="truncate font-medium text-ink">
                    {job.source_title || "Clipping job"}
                  </h3>
                  <p className="mt-1 text-sm text-ink-soft">{job.status.replaceAll("_", " ")}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-ink-mute" />
              </Link>
            ))}
          </div>
          {!jobs.length && (
            <div className="rounded-2xl border border-dashed border-line p-8 text-center">
              <Scissors className="mx-auto h-8 w-8 text-ink-mute" />
              <h3 className="mt-4 font-display text-xl text-ink">Your first clips start here</h3>
              <p className="mt-2 text-sm text-ink-soft">
                Upload a video or paste an eligible YouTube URL. Confirm your rights, choose
                settings and follow the job.
              </p>
              <Link
                to="/app/youtube-clipper/new"
                className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-ink px-4 text-sm text-surface-page"
              >
                Create clips
              </Link>
            </div>
          )}
        </section>
        <aside className="h-fit rounded-2xl border border-line bg-surface-panel p-6">
          <h2 className="mb-4 font-display text-xl text-ink">This month's usage</h2>
          <UsageMeter label="Source minutes" used={used} total={limit} unit="min" />
          <p className="mt-3 text-xs text-ink-mute">Includes minutes reserved for ongoing jobs.</p>
          <Link
            to="/app/usage"
            className="mt-5 inline-flex min-h-11 items-center text-sm text-ember-ink"
          >
            View usage and limits <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </aside>
      </div>
    </div>
  );
}
