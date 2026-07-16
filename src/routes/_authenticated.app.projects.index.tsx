import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { AppPageHeader } from "@/components/app/layout";
import { StatusDot } from "@/components/primitives/status-dot";
import { SelectField } from "@/components/ui/select-field";
import { listProjects } from "@/services/projects/server";

export const Route = createFileRoute("/_authenticated/app/projects/")({
  head: () => ({ meta: [{ title: "Projects — Vidrial" }] }),
  loader: () => listProjects(),
  pendingComponent: () => <ProjectListSkeleton />,
  component: Projects,
});

function Projects() {
  const projects = Route.useLoaderData();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"updated" | "name">("updated");
  const filtered = useMemo(
    () =>
      [...projects]
        .filter((project) => project.name.toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) =>
          sort === "name"
            ? a.name.localeCompare(b.name)
            : new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
        ),
    [projects, query, sort],
  );
  const date = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });
  return (
    <div>
      <AppPageHeader
        title="Projects"
        description="Private projects keep uploaded media, editor timelines and version history together."
        actions={
          <Link
            to="/app/projects/new"
            className="inline-flex min-h-11 items-center rounded-md bg-ink px-4 text-sm font-medium text-surface-page"
          >
            New project
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="relative min-w-[220px] flex-1">
          <span className="sr-only">Search projects</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            name="project-search"
            autoComplete="off"
            placeholder="Search projects…"
            className="min-h-11 w-full rounded-md border border-line bg-surface-panel pl-10 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ember"
          />
        </label>
        <SelectField
          className="w-48"
          label="Sort projects"
          value={sort}
          onValueChange={(value) => setSort(value as "updated" | "name")}
          options={[
            { value: "updated", label: "Recently updated" },
            { value: "name", label: "Name (A–Z)" },
          ]}
        />
      </div>
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface-panel">
        <table className="w-full min-w-[620px] text-sm">
          <thead className="bg-surface-sunken text-left text-[11px] uppercase tracking-wider text-ink-mute">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Assets</th>
              <th className="px-4 py-3">Duration</th>
              <th className="px-4 py-3">Updated</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((project) => (
              <tr key={project.id} className="border-t border-line hover:bg-surface-sunken/50">
                <td className="px-4 py-3">
                  <Link
                    to="/app/projects/$projectId"
                    params={{ projectId: project.id }}
                    className="font-medium text-ink hover:text-ember-ink"
                  >
                    {project.name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <StatusDot variant={project.status === "in-progress" ? "info" : "muted"}>
                    {project.status}
                  </StatusDot>
                </td>
                <td className="px-4 py-3 text-ink-soft">{project.assetCount}</td>
                <td className="px-4 py-3 tabular-nums text-ink-soft">
                  {Math.round(project.durationSeconds)}s
                </td>
                <td className="px-4 py-3 text-ink-mute">
                  {date.format(new Date(project.updated_at))}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-ink-mute">
                  {projects.length === 0
                    ? "No projects yet. Create your first cloud project."
                    : `No projects match “${query}”.`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProjectListSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading projects" className="space-y-4">
      <div className="h-10 w-52 animate-pulse rounded bg-surface-sunken motion-reduce:animate-none" />
      <div className="h-64 animate-pulse rounded-2xl bg-surface-sunken motion-reduce:animate-none" />
    </div>
  );
}
