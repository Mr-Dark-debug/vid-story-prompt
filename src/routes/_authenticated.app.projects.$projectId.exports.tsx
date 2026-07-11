import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, Trash2, RefreshCw, Copy } from "lucide-react";
import { StatusDot } from "@/components/primitives/status-dot";

type Job = {
  id: string;
  preset: string;
  aspect: string;
  state: "queued" | "preparing" | "rendering" | "uploading" | "complete" | "failed";
  progress: number;
  createdAt: string;
  url?: string;
};

const initial: Job[] = [
  { id: "e1", preset: "YouTube 1080p", aspect: "16:9", state: "complete", progress: 100, createdAt: new Date(Date.now() - 3600e3).toISOString(), url: "https://example.com/export/e1.mp4" },
  { id: "e2", preset: "Reels 1080×1920", aspect: "9:16", state: "complete", progress: 100, createdAt: new Date(Date.now() - 7200e3).toISOString(), url: "https://example.com/export/e2.mp4" },
];

export const Route = createFileRoute("/_authenticated/app/projects/$projectId/exports")({
  component: ExportsPage,
});

function ExportsPage() {
  useParams({ from: "/_authenticated/app/projects/$projectId/exports" });
  const [jobs, setJobs] = useState<Job[]>(initial);

  useEffect(() => {
    const t = setInterval(() => {
      setJobs((prev) =>
        prev.map((j) => {
          if (j.state === "complete" || j.state === "failed") return j;
          const nextProgress = Math.min(100, j.progress + 8 + Math.random() * 10);
          const seq: Job["state"][] = ["queued", "preparing", "rendering", "uploading", "complete"];
          const idx = seq.indexOf(j.state);
          const advance = nextProgress > (idx + 1) * 22;
          return {
            ...j,
            progress: nextProgress,
            state: nextProgress >= 100 ? "complete" : advance ? seq[Math.min(idx + 1, seq.length - 2)] : j.state,
            url: nextProgress >= 100 ? `https://example.com/export/${j.id}.mp4` : j.url,
          };
        }),
      );
    }, 900);
    return () => clearInterval(t);
  }, []);

  function startExport(preset: string, aspect: string) {
    setJobs((p) => [
      { id: `e_${Date.now()}`, preset, aspect, state: "queued", progress: 0, createdAt: new Date().toISOString() },
      ...p,
    ]);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => startExport("YouTube 1080p", "16:9")} className="rounded-md bg-ink px-3 py-2 text-sm font-medium text-surface-page">
          Export · 16:9
        </button>
        <button onClick={() => startExport("Reels 1080×1920", "9:16")} className="rounded-md border border-line bg-surface-panel px-3 py-2 text-sm text-ink">
          Export · 9:16
        </button>
        <button onClick={() => startExport("Square 1080", "1:1")} className="rounded-md border border-line bg-surface-panel px-3 py-2 text-sm text-ink">
          Export · 1:1
        </button>
        <StatusDot variant="demo">Renders are simulated</StatusDot>
      </div>
      <ul className="space-y-2">
        {jobs.map((j) => (
          <li key={j.id} className="rounded-xl border border-line bg-surface-panel p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-medium text-ink">{j.preset}</div>
                <div className="text-[11px] text-ink-mute">{j.aspect} · {new Date(j.createdAt).toLocaleString()}</div>
              </div>
              <div className="flex items-center gap-2">
                <StatusDot variant={j.state === "complete" ? "success" : j.state === "failed" ? "danger" : "info"}>{j.state}</StatusDot>
                {j.url && (
                  <>
                    <a href={j.url} className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-page px-2 py-1 text-[11px] text-ink"><Download className="h-3 w-3" /> Download</a>
                    <button onClick={() => navigator.clipboard?.writeText(j.url!)} className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-page px-2 py-1 text-[11px] text-ink-soft"><Copy className="h-3 w-3" /> Copy link</button>
                  </>
                )}
                {j.state === "failed" && (
                  <button className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-page px-2 py-1 text-[11px] text-ink-soft"><RefreshCw className="h-3 w-3" /> Retry</button>
                )}
                <button onClick={() => setJobs((p) => p.filter((x) => x.id !== j.id))} aria-label="Delete" className="rounded p-1 text-ink-mute hover:bg-surface-sunken"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            {j.state !== "complete" && j.state !== "failed" && (
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                <div className="h-full bg-ember transition-all" style={{ width: `${j.progress}%` }} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}