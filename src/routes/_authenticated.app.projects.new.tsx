import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { AppPageHeader } from "@/components/app/layout";
import { Callout } from "@/components/primitives/section";
import { Button } from "@/components/ui/button";
import { SourceUpload, type UploadedSource } from "@/components/youtube-clipper/source-upload";
import { createProject, deleteProject, updateProject } from "@/services/projects/server";
import { userFacingError } from "@/lib/user-facing-error";

export const Route = createFileRoute("/_authenticated/app/projects/new")({
  head: () => ({ meta: [{ title: "New project — Vidrial" }] }),
  component: ProjectWizard,
});

const steps = ["Details", "Media", "Brief", "Review"] as const;

function ProjectWizard() {
  const navigate = useNavigate();
  const nameRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [aspect, setAspect] = useState<"16:9" | "9:16" | "1:1">("16:9");
  const [brief, setBrief] = useState("");
  const [uploads, setUploads] = useState<UploadedSource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const next = async () => {
    if (step === 0 && !name.trim()) {
      setError("Give this project a name.");
      nameRef.current?.focus();
      return;
    }
    setError(null);
    setBusy(true);
    try {
      let id = projectId;
      if (step === 0 && !id) {
        const project = await createProject({ data: { name, aspect, brief: "" } });
        id = project.id;
        setProjectId(id);
      }
      if (step < steps.length - 1) setStep((value) => value + 1);
      else if (id) {
        await updateProject({ data: { projectId: id, name, aspect, brief } });
        await navigate({ to: "/app/projects/$projectId", params: { projectId: id } });
      }
    } catch (cause) {
      setError(userFacingError(cause, "The project could not be saved. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (projectId) await deleteProject({ data: { projectId, confirmation: "DELETE" } });
    await navigate({ to: "/app/projects" });
  };

  return (
    <div>
      <AppPageHeader
        eyebrow="New project"
        title="Set up a video"
        description="Create a private project, add authorised media and keep every saved version."
      />
      <ol className="mb-6 grid grid-cols-4 gap-1 text-[11px]" aria-label="Project setup progress">
        {steps.map((label, index) => (
          <li
            key={label}
            aria-current={index === step ? "step" : undefined}
            className={`min-w-0 rounded-md border px-2 py-2 ${index <= step ? "border-ember/40 bg-ember-soft text-ember-ink" : "border-line bg-surface-panel text-ink-mute"}`}
          >
            <span className="tabular-nums">{index + 1}</span>{" "}
            <span className="truncate">{label}</span>
          </li>
        ))}
      </ol>

      <section
        className="rounded-2xl border border-line bg-surface-panel p-5 sm:p-6"
        aria-labelledby="project-step-title"
      >
        {step === 0 && (
          <div className="space-y-4">
            <h2 id="project-step-title" className="font-display text-xl text-ink">
              Project details
            </h2>
            <label className="grid gap-1.5 text-sm text-ink">
              Project name
              <input
                ref={nameRef}
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-invalid={Boolean(error && !name.trim())}
                placeholder="Autumn roastery launch…"
                className="min-h-11 rounded-md border border-line bg-surface-page px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ember"
              />
            </label>
            <fieldset>
              <legend className="mb-2 text-sm text-ink">Aspect ratio</legend>
              <div className="flex flex-wrap gap-2">
                {(["16:9", "9:16", "1:1"] as const).map((value) => (
                  <Button
                    key={value}
                    type="button"
                    variant={aspect === value ? "default" : "outline"}
                    onClick={() => setAspect(value)}
                    aria-pressed={aspect === value}
                  >
                    {value}
                  </Button>
                ))}
              </div>
            </fieldset>
          </div>
        )}
        {step === 1 && (
          <div>
            <h2 id="project-step-title" className="font-display text-xl text-ink">
              Authorised media
            </h2>
            <p className="mt-1 mb-5 text-sm text-ink-soft">
              Uploads are stored privately and remain attached to this project.
            </p>
            {projectId && (
              <SourceUpload
                projectId={projectId}
                onUploaded={(source) => setUploads((items) => [...items, source])}
              />
            )}
            {uploads.length > 0 && (
              <ul className="mt-4 space-y-2" aria-live="polite">
                {uploads.map((upload) => (
                  <li
                    key={upload.assetId}
                    className="rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm text-ink"
                  >
                    {upload.filename} <span className="text-ink-mute">· uploaded</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-ink-mute">
              You can add more files from the project’s Media tab.
            </p>
          </div>
        )}
        {step === 2 && (
          <div>
            <h2 id="project-step-title" className="font-display text-xl text-ink">
              Editing brief
            </h2>
            <label className="mt-4 grid gap-1.5 text-sm text-ink">
              What should this video accomplish?
              <textarea
                value={brief}
                onChange={(event) => setBrief(event.target.value)}
                rows={7}
                maxLength={5000}
                placeholder="Describe the audience, tone, pacing, opening and final action…"
                className="rounded-md border border-line bg-surface-page p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ember"
              />
            </label>
          </div>
        )}
        {step === 3 && (
          <div>
            <h2 id="project-step-title" className="font-display text-xl text-ink">
              Review project
            </h2>
            <dl className="mt-4 divide-y divide-line rounded-xl border border-line">
              {[
                ["Name", name],
                ["Aspect", aspect],
                ["Uploaded media", String(uploads.length)],
                ["Brief", brief || "No brief yet"],
              ].map(([label, value]) => (
                <div key={label} className="grid gap-1 px-4 py-3 sm:grid-cols-[150px_1fr]">
                  <dt className="text-xs font-medium text-ink-mute">{label}</dt>
                  <dd className="break-words text-sm text-ink">{value}</dd>
                </div>
              ))}
            </dl>
            <Callout tone="success" title="Ready to create">
              The project, assets and future editor versions are securely stored in your private
              workspace.
            </Callout>
          </div>
        )}
        {error && (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
          >
            {error}
          </p>
        )}
      </section>

      <div className="mt-6 flex justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => (step === 0 ? void cancel() : setStep((value) => value - 1))}
          disabled={busy}
        >
          <ArrowLeft />
          {step === 0 ? "Cancel" : "Back"}
        </Button>
        <Button type="button" onClick={() => void next()} loading={busy} loadingText="Saving…">
          {step === steps.length - 1 ? (
            <>
              <Check />
              Create project
            </>
          ) : (
            <>
              Next
              <ArrowRight />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
