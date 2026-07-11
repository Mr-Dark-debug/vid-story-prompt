import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, PlayCircle, Clock, UploadCloud, FileVideo } from "lucide-react";
import { AppPageHeader } from "@/components/app/layout";
import { StatusDot } from "@/components/primitives/status-dot";
import { UsageMeter } from "@/components/primitives/usage-meter";
import { loadProjects, type MockProject } from "@/mock/seed";
import { useSession } from "@/services/auth";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({ meta: [{ title: "Overview — Vidrial" }] }),
  component: Dashboard,
});

function Dashboard() {
  const user = useSession();
  const [projects, setProjects] = useState<MockProject[]>([]);
  useEffect(() => {
    setProjects(loadProjects());
    const sync = () => setProjects(loadProjects());
    window.addEventListener("vidrial:projects", sync);
    return () => window.removeEventListener("vidrial:projects", sync);
  }, []);
  return (
    <div>
      <AppPageHeader
        eyebrow={`Welcome back${user ? `, ${user.name.split(" ")[0]}` : ""}`}
        title="Your video projects"
        description="Pick up where you left off, or start a new one from a folder of raw footage."
        actions={
          <Link
            to="/app/projects/new"
            className="rounded-md bg-ink px-3 py-2 text-sm font-medium text-surface-page"
          >
            New project
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg text-ink">Recent projects</h2>
            <Link to="/app/projects" className="text-sm text-ember-ink">
              All projects <ArrowRight className="inline h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {projects.map((p) => (
              <Link
                key={p.id}
                to="/app/projects/$projectId"
                params={{ projectId: p.id }}
                className="group rounded-2xl border border-line bg-surface-panel p-4 transition-colors hover:border-line-strong"
              >
                <div className="flex aspect-video items-center justify-center rounded-md bg-surface-sunken">
                  <PlayCircle className="h-8 w-8 text-ink-mute group-hover:text-ember" />
                </div>
                <div className="mt-3 font-display text-base text-ink">{p.name}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-ink-mute">
                  <StatusDot variant={p.status === "in-progress" ? "info" : "muted"}>
                    {p.status.replace("-", " ")}
                  </StatusDot>
                  <span>{Math.round(p.durationSec)}s</span>
                  <span>· {p.assets.length} assets</span>
                </div>
              </Link>
            ))}
            <Link
              to="/app/projects/new"
              className="flex min-h-[180px] items-center justify-center rounded-2xl border border-dashed border-line bg-surface-panel/60 p-6 text-sm text-ink-soft hover:border-ember hover:text-ember-ink"
            >
              + New project
            </Link>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-line bg-surface-panel p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-ink">
              <Clock className="h-4 w-4 text-ember" /> Usage this month
            </div>
            <div className="mt-4 space-y-3">
              <UsageMeter label="Source minutes" used={214} total={600} unit="min" />
              <UsageMeter label="Rendered exports" used={11} total={40} unit="renders" />
              <UsageMeter label="Generation credits" used={40} total={200} unit="credits" />
            </div>
            <Link to="/app/usage" className="mt-4 inline-flex text-sm text-ember-ink">
              Usage detail <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="rounded-2xl border border-line bg-surface-panel p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-ink">
              <UploadCloud className="h-4 w-4 text-teal" /> Upload status
            </div>
            <p className="mt-1 text-sm text-ink-soft">
              All uploads are processed on-device in this preview. Real uploads happen when Cloud is enabled.
            </p>
            <StatusDot className="mt-3" variant="demo">Simulated</StatusDot>
          </div>
          <div className="rounded-2xl border border-line bg-surface-panel p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-ink">
              <FileVideo className="h-4 w-4 text-ember" /> Recent exports
            </div>
            <ul className="mt-3 space-y-2 text-sm text-ink-soft">
              <li className="flex justify-between"><span>Launch · 1080p</span><span className="text-ink-mute">2d ago</span></li>
              <li className="flex justify-between"><span>Launch · 9:16</span><span className="text-ink-mute">2d ago</span></li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}