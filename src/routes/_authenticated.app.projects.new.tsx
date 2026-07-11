import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppPageHeader } from "@/components/app/layout";
import { StatusDot } from "@/components/primitives/status-dot";
import { Callout } from "@/components/primitives/section";
import { upsertProject, demoProject, type MockProject } from "@/mock/seed";
import { UploadCloud, Check, ArrowRight, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/projects/new")({
  head: () => ({ meta: [{ title: "New project — Vidrial" }] }),
  component: Wizard,
});

const steps = ["Details", "Media", "Organise", "Brief", "Review"] as const;

function Wizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [aspect, setAspect] = useState<"16:9" | "9:16" | "1:1">("16:9");
  const [brief, setBrief] = useState("");
  const [files, setFiles] = useState<{ name: string; size: number }[]>([]);
  const [nameError, setNameError] = useState<string | null>(null);

  function next() {
    if (step === 0 && !name.trim()) {
      setNameError("Give this project a name.");
      return;
    }
    setNameError(null);
    if (step < steps.length - 1) setStep(step + 1);
    else finish();
  }

  function finish() {
    const template = demoProject();
    const proj: MockProject = {
      ...template,
      id: `prj_${Date.now().toString(36)}`,
      name: name.trim(),
      brief: brief.trim() || template.brief,
      aspect,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "in-progress",
    };
    upsertProject(proj);
    navigate({ to: "/app/projects/$projectId", params: { projectId: proj.id } });
  }

  function drop(e: React.DragEvent) {
    e.preventDefault();
    const items = Array.from(e.dataTransfer.files).map((f) => ({ name: f.name, size: f.size }));
    setFiles((s) => [...s, ...items]);
  }

  return (
    <div>
      <AppPageHeader
        eyebrow="New project"
        title="Set up a video"
        description="Five short steps. Nothing here is destructive — you can change everything later."
      />
      <ol className="mb-6 grid grid-cols-5 gap-1 text-[11px]">
        {steps.map((label, i) => (
          <li
            key={label}
            className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 ${
              i <= step ? "border-ember/40 bg-ember-soft text-ember-ink" : "border-line bg-surface-panel text-ink-mute"
            }`}
          >
            <span className="tabular-nums">{i + 1}</span>
            <span className="truncate">{label}</span>
          </li>
        ))}
      </ol>

      <div className="rounded-2xl border border-line bg-surface-panel p-6">
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-ink">Project name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Autumn Roastery Launch"
                className="w-full rounded-md border border-line bg-surface-page px-3 py-2 text-sm text-ink outline-none focus:border-ember"
              />
              {nameError && <div className="mt-1 text-xs text-danger">{nameError}</div>}
            </div>
            <div>
              <label className="mb-1 block text-sm text-ink">Aspect ratio</label>
              <div className="flex gap-2">
                {(["16:9", "9:16", "1:1"] as const).map((a) => (
                  <button
                    key={a}
                    onClick={() => setAspect(a)}
                    className={`rounded-md border px-3 py-2 text-sm ${
                      aspect === a ? "border-ember bg-ember-soft text-ember-ink" : "border-line bg-surface-panel text-ink-soft"
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {step === 1 && (
          <div>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={drop}
              className="flex min-h-[180px] items-center justify-center rounded-xl border-2 border-dashed border-line-strong bg-surface-page text-center text-sm text-ink-soft"
            >
              <div>
                <UploadCloud className="mx-auto mb-2 h-6 w-6 text-ember" />
                Drag video, audio, images or subtitles here.
                <div className="text-[11px] text-ink-mute">Uploads are simulated in this preview.</div>
              </div>
            </div>
            <ul className="mt-4 space-y-1 text-sm">
              {files.map((f, i) => (
                <li key={i} className="flex items-center justify-between rounded-md border border-line bg-surface-page px-3 py-2">
                  <span className="truncate">{f.name}</span>
                  <StatusDot variant="demo">Simulated</StatusDot>
                </li>
              ))}
              {files.length === 0 && <li className="text-xs text-ink-mute">No files yet — that's fine, you can add them later.</li>}
            </ul>
          </div>
        )}
        {step === 2 && (
          <Callout tone="info" title="Tags and roles">
            When Cloud is enabled, dropped media is auto-tagged (interview, b-roll, music, etc.). In this preview we skip
            straight to the timeline.
          </Callout>
        )}
        {step === 3 && (
          <div>
            <label className="mb-1 block text-sm text-ink">Editing brief</label>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={6}
              placeholder="Describe the video you want. Tone, length, audience, what to open on, what to close on."
              className="w-full rounded-md border border-line bg-surface-page px-3 py-2 text-sm text-ink outline-none focus:border-ember"
            />
          </div>
        )}
        {step === 4 && (
          <div className="space-y-2 text-sm">
            <Row k="Name" v={name || "—"} />
            <Row k="Aspect" v={aspect} />
            <Row k="Media added" v={`${files.length} file(s)`} />
            <Row k="Brief" v={brief || "—"} />
            <Callout tone="success" title="Estimated usage">
              This preview seeds the project with the Autumn Roastery demo timeline so you can explore the editor immediately.
            </Callout>
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-between">
        <button
          onClick={() => (step === 0 ? navigate({ to: "/app/projects" }) : setStep(step - 1))}
          className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-panel px-3 py-2 text-sm"
        >
          <ArrowLeft className="h-4 w-4" /> {step === 0 ? "Cancel" : "Back"}
        </button>
        <button
          onClick={next}
          className="inline-flex items-center gap-1 rounded-md bg-ink px-3 py-2 text-sm font-medium text-surface-page"
        >
          {step === steps.length - 1 ? (
            <>
              <Check className="h-4 w-4" /> Create project
            </>
          ) : (
            <>
              Next <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-line py-1.5">
      <span className="text-ink-mute">{k}</span>
      <span className="text-ink">{v}</span>
    </div>
  );
}