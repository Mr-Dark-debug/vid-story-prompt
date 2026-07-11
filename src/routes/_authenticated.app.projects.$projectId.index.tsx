import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { loadProjects, type MockProject } from "@/mock/seed";
import { StatusDot } from "@/components/primitives/status-dot";
import { Callout } from "@/components/primitives/section";
import { PlayCircle, Film, FileText, History, Package, Wand2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/projects/$projectId/")({
  component: Overview,
});

function Overview() {
  const { projectId } = useParams({ from: "/_authenticated/app/projects/$projectId/" });
  const [project, setProject] = useState<MockProject | null>(null);
  useEffect(() => {
    setProject(loadProjects().find((p) => p.id === projectId) ?? null);
  }, [projectId]);
  if (!project) return null;
  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <section className="rounded-2xl border border-line bg-surface-panel p-6">
        <div className="flex aspect-video items-center justify-center rounded-md bg-surface-sunken">
          <PlayCircle className="h-10 w-10 text-ink-mute" />
        </div>
        <h2 className="mt-5 font-display text-xl text-ink">Brief</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{project.brief}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            to="/app/projects/$projectId/editor"
            params={{ projectId }}
            className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-2 text-sm font-medium text-surface-page"
          >
            <Wand2 className="h-4 w-4" /> Open editor
          </Link>
          <Link
            to="/app/projects/$projectId/transcript"
            params={{ projectId }}
            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface-panel px-3 py-2 text-sm text-ink"
          >
            <FileText className="h-4 w-4" /> Transcript
          </Link>
        </div>
      </section>
      <aside className="space-y-3">
        <Callout tone="info" title="Demo data">
          This project is seeded from the Autumn Roastery demo so you can explore every tab.
        </Callout>
        <Row icon={Film} label="Assets" value={String(project.assets.length)} />
        <Row icon={FileText} label="Transcript words" value={String(project.transcript.length)} />
        <Row icon={History} label="Versions" value={String(project.versions.length)} />
        <Row icon={Package} label="Exports" value="2 completed" />
        <StatusDot variant="demo">Simulated</StatusDot>
      </aside>
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: typeof Film; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-line bg-surface-panel px-4 py-3">
      <span className="flex items-center gap-2 text-sm text-ink-soft"><Icon className="h-4 w-4 text-ember" /> {label}</span>
      <span className="text-sm text-ink">{value}</span>
    </div>
  );
}