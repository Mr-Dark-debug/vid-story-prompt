import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppPageHeader } from "@/components/app/layout";
import { StatusDot } from "@/components/primitives/status-dot";
import { loadProjects, type MockProject } from "@/mock/seed";
import { Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/projects/")({
  head: () => ({ meta: [{ title: "Projects — Vidrial" }] }),
  component: Projects,
});

function Projects() {
  const [projects, setProjects] = useState<MockProject[]>([]);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"updated" | "name">("updated");
  useEffect(() => {
    setProjects(loadProjects());
  }, []);
  const filtered = projects
    .filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  return (
    <div>
      <AppPageHeader
        title="Projects"
        description="Every project keeps its media, transcript, timeline and versions in one place."
        actions={
          <Link
            to="/app/projects/new"
            className="rounded-md bg-ink px-3 py-2 text-sm font-medium text-surface-page"
          >
            New project
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search projects"
            className="w-full rounded-md border border-line bg-surface-panel py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-ember"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as "updated" | "name")}
          className="rounded-md border border-line bg-surface-panel px-3 py-2 text-sm text-ink"
        >
          <option value="updated">Recently updated</option>
          <option value="name">Name (A–Z)</option>
        </select>
      </div>
      <div className="overflow-hidden rounded-2xl border border-line bg-surface-panel">
        <table className="w-full text-sm">
          <thead className="bg-surface-sunken text-left text-[11px] uppercase tracking-wider text-ink-mute">
            <tr>
              <th className="px-4 py-2.5">Name</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5 hidden sm:table-cell">Assets</th>
              <th className="px-4 py-2.5 hidden md:table-cell">Duration</th>
              <th className="px-4 py-2.5">Updated</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-t border-line hover:bg-surface-sunken/50">
                <td className="px-4 py-3">
                  <Link
                    to="/app/projects/$projectId"
                    params={{ projectId: p.id }}
                    className="font-medium text-ink hover:text-ember-ink"
                  >
                    {p.name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <StatusDot variant={p.status === "in-progress" ? "info" : "muted"}>
                    {p.status.replace("-", " ")}
                  </StatusDot>
                </td>
                <td className="px-4 py-3 text-ink-soft hidden sm:table-cell">{p.assets.length}</td>
                <td className="px-4 py-3 text-ink-soft hidden md:table-cell">{Math.round(p.durationSec)}s</td>
                <td className="px-4 py-3 text-ink-mute">{new Date(p.updatedAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-ink-mute">
                  No projects match “{q}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}