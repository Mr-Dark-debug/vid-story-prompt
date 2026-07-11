import { createFileRoute } from "@tanstack/react-router";
import { AppPageHeader } from "@/components/app/layout";
import { StatusDot } from "@/components/primitives/status-dot";
import { UploadCloud, RefreshCw } from "lucide-react";
import { useState } from "react";

type Row = { id: string; name: string; state: "uploading" | "analysing" | "ready" | "failed"; progress: number };
const seed: Row[] = [
  { id: "u1", name: "Interview — Ava & Ben.mp4", state: "ready", progress: 100 },
  { id: "u2", name: "Pouring shot — macro.mov", state: "analysing", progress: 78 },
  { id: "u3", name: "Roaster drum.mov", state: "uploading", progress: 44 },
  { id: "u4", name: "Corrupted-take-2.mov", state: "failed", progress: 12 },
];

export const Route = createFileRoute("/_authenticated/app/uploads")({
  head: () => ({ meta: [{ title: "Uploads — Vidrial" }] }),
  component: Uploads,
});

function Uploads() {
  const [rows, setRows] = useState(seed);
  return (
    <div>
      <AppPageHeader
        title="Uploads"
        description="Files are analysed after upload. Retry failed items or remove them."
        eyebrow="Media pipeline"
        actions={
          <button className="inline-flex items-center gap-2 rounded-md bg-ink px-3 py-2 text-sm font-medium text-surface-page">
            <UploadCloud className="h-4 w-4" /> Add files
          </button>
        }
      />
      <div className="rounded-2xl border border-line bg-surface-panel">
        <ul>
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 border-b border-line px-5 py-3 last:border-b-0">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-ink">{r.name}</div>
                {r.state !== "ready" && r.state !== "failed" && (
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-sunken">
                    <div className="h-full bg-ember" style={{ width: `${r.progress}%` }} />
                  </div>
                )}
              </div>
              <StatusDot variant={r.state === "ready" ? "success" : r.state === "failed" ? "danger" : "info"}>{r.state}</StatusDot>
              {r.state === "failed" && (
                <button
                  onClick={() => setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, state: "uploading", progress: 5 } : x)))}
                  className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-page px-2 py-1 text-[11px] text-ink"
                >
                  <RefreshCw className="h-3 w-3" /> Retry
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}