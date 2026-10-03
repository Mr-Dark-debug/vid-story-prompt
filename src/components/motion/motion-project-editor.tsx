import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { AppPageHeader } from "@/components/app/layout";
import { Button } from "@/components/ui/button";
import { MotionPreview } from "./motion-preview";
import { lintMotionHtml } from "@/domain/motion/lint";
import {
  saveMotionVersion,
  generateMotionVersion,
  requestMotionRender,
  cancelMotionTask,
  getMotionProject,
  getMotionCapabilities,
  analyzeMotionReference,
} from "@/services/motion/server";
import { userFacingError } from "@/lib/user-facing-error";
import { MotionReferencePicker, type MotionReferenceUploads } from "./motion-reference-picker";
import { MotionReferenceResult } from "./motion-reference-result";
import { referenceMotionBriefSchema } from "@/domain/motion/reference-brief";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Props = {
  detail: Awaited<ReturnType<typeof getMotionProject>>;
  capabilities: Awaited<ReturnType<typeof getMotionCapabilities>>;
  uploads?: MotionReferenceUploads;
};
const inputClass =
  "min-h-11 w-full rounded-lg border border-line bg-surface-panel px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ember";
const activeStatuses = new Set(["queued", "running", "leased", "retrying", "pending"]);

export function MotionProjectEditor({ detail, capabilities, uploads = [] }: Props) {
  const router = useRouter();
  const { project, versions, renders, tasks } = detail;
  const [selectedId, setSelectedId] = useState<string | null>(versions[0]?.id ?? null);
  const selected = versions.find((version) => version.id === selectedId) ?? versions[0];
  const [source, setSource] = useState(selected?.htmlSource ?? "");
  const [tab, setTab] = useState<"preview" | "code">(selected ? "preview" : "code");
  const [instruction, setInstruction] = useState("");
  const [referenceId, setReferenceId] = useState("");
  const [referenceRights, setReferenceRights] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showNewVersion, setShowNewVersion] = useState(false);
  const keys = useRef(new Map<string, string>());
  const lint = useMemo(
    () => lintMotionHtml(source, project.renderSpec.durationSeconds),
    [source, project.renderSpec.durationSeconds],
  );
  const dirty = source !== (selected?.htmlSource ?? "");
  const activeTasks = tasks.filter((task) => activeStatuses.has(task.status));
  const latestFailure = tasks[0]?.status === "failed" ? tasks[0] : null;
  const active = activeTasks.length > 0;
  const savedLint = selected
    ? lintMotionHtml(selected.htmlSource, project.renderSpec.durationSeconds)
    : null;
  const latestId = versions[0]?.id;
  const referenceAvailable =
    capabilities.referenceEnabled &&
    capabilities.models.some((model) => model.id === project.modelId && model.supportsVision);
  const latestReference = detail.referenceAnalyses[0];
  const referenceReady =
    !latestReference ||
    (latestReference.status === "ready" &&
      referenceMotionBriefSchema.safeParse(latestReference.brief).success);

  useEffect(() => {
    if (latestId && latestId !== selectedId) setShowNewVersion(true);
  }, [latestId, selectedId]);
  useEffect(() => {
    if (!active) return;
    let invalidating = false;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible" || invalidating) return;
      invalidating = true;
      void router
        .invalidate()
        .catch(() => undefined)
        .finally(() => {
          invalidating = false;
        });
    }, 3000);
    return () => window.clearInterval(timer);
  }, [active, router]);

  useEffect(() => {
    try {
      const client = getSupabaseBrowserClient();
      const refresh = () => {
        void router.invalidate().catch(() => undefined);
      };
      const channel = client
        .channel(`motion-project:${project.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "motion_projects",
            filter: `id=eq.${project.id}`,
          },
          refresh,
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "motion_renders",
            filter: `project_id=eq.${project.id}`,
          },
          refresh,
        )
        .subscribe();
      return () => {
        void client.removeChannel(channel);
      };
    } catch {
      /* Explicitly unconfigured fixtures retain bounded polling. */
    }
  }, [project.id, router]);

  const run = async (name: string, work: () => Promise<void>) => {
    if (busy) return;
    setBusy(name);
    setError(null);
    setNotice(null);
    try {
      await work();
      await router.invalidate();
    } catch (cause) {
      setError(
        userFacingError(
          cause,
          "This action could not be completed. Your saved versions remain available.",
        ),
      );
    } finally {
      setBusy(null);
    }
  };
  const key = (scope: string) => {
    let value = keys.current.get(scope);
    if (!value) {
      value = crypto.randomUUID();
      keys.current.set(scope, value);
    }
    return value;
  };
  const loadVersion = (id: string) => {
    const next = versions.find((version) => version.id === id);
    if (!next) return;
    if (dirty && !window.confirm("Discard the unsaved code edits and open this saved version?"))
      return;
    setSelectedId(id);
    setSource(next.htmlSource);
    setShowNewVersion(false);
    setNotice(null);
    setError(null);
  };
  const save = () =>
    run("save", async () => {
      if (!lint.ok) throw new Error("Fix the lint errors before saving.");
      const result = await saveMotionVersion({
        data: { projectId: project.id, htmlSource: source, parentVersionId: selected?.id },
      });
      setSelectedId(result.versionId);
      setNotice("A new immutable version was saved.");
    });
  const generate = () =>
    run("generate", async () => {
      if (!referenceReady)
        throw new Error("Complete a valid reference analysis before generating this scene.");
      const scope = `generate:${selected?.id ?? "first"}:${instruction}`;
      await generateMotionVersion({
        data: {
          projectId: project.id,
          parentVersionId: selected?.id,
          instruction: instruction.trim() || undefined,
          idempotencyKey: key(scope),
        },
      });
      keys.current.delete(scope);
      setNotice("Generation was queued. It continues if you leave this page.");
      setInstruction("");
    });
  const render = () =>
    run("render", async () => {
      if (!selected || dirty || !savedLint?.ok)
        throw new Error("Save a linted version before rendering.");
      const scope = `render:${selected.id}`;
      await requestMotionRender({
        data: { projectId: project.id, versionId: selected.id, idempotencyKey: key(scope) },
      });
      keys.current.delete(scope);
      setNotice("MP4 export was queued. Download appears after the worker verifies the output.");
    });
  const analyzeReference = () =>
    run("reference", async () => {
      if (!referenceId || !referenceRights || !referenceAvailable)
        throw new Error("Select an authorised reference and accept the rights statement.");
      const scope = `reference:${referenceId}`;
      await analyzeMotionReference({
        data: {
          projectId: project.id,
          mediaAssetId: referenceId,
          rightsAccepted: true,
          idempotencyKey: key(scope),
        },
      });
      keys.current.delete(scope);
      setNotice("Reference analysis was queued. Review its motion brief before generating.");
    });
  const download = (renderId: string) =>
    run(`download:${renderId}`, async () => {
      // Signed URLs expire. Resolve a fresh authorised URL at the user's download action.
      const fresh = await getMotionProject({ data: { projectId: project.id } });
      const output = fresh.renders.find((item) => item.id === renderId && item.status === "ready");
      if (!output?.outputUrl)
        throw new Error("The verified export is not available to download. Try again shortly.");
      const anchor = document.createElement("a");
      anchor.href = output.outputUrl;
      anchor.download = "";
      anchor.rel = "noopener noreferrer";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setNotice("Download requested using a fresh signed URL.");
    });

  return (
    <div className="min-w-0">
      <AppPageHeader
        eyebrow={`Motion Studio · ${project.status.replaceAll("_", " ")}`}
        title={project.title}
        description={`${project.renderSpec.width} × ${project.renderSpec.height} · ${project.renderSpec.aspect} · ${project.renderSpec.durationSeconds}s · ${project.renderSpec.fps} fps`}
        actions={
          <Button asChild variant="outline">
            <Link to="/app/motion">All projects</Link>
          </Button>
        }
      />
      <div aria-live="polite" className="mb-4 space-y-2">
        {latestFailure && (
          <p
            role="alert"
            className="rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm text-danger"
          >
            The latest {latestFailure.type.replaceAll("_", " ")} task failed:{" "}
            {latestFailure.errorCode?.replaceAll("_", " ") ?? "the worker could not complete it"}.
            Your saved versions remain available.
          </p>
        )}
        {notice && (
          <p className="rounded-xl border border-line bg-surface-sunken p-3 text-sm text-ink">
            {notice}
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm text-danger"
          >
            {error}
          </p>
        )}
        {showNewVersion && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface-sunken p-3 text-sm text-ink">
            <p>A saved version is available.</p>
            <Button variant="outline" size="sm" onClick={() => latestId && loadVersion(latestId)}>
              Open latest version
            </Button>
          </div>
        )}
      </div>
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="min-w-0 rounded-2xl border border-line bg-surface-panel p-4 sm:p-6">
          <div
            className="mb-5 flex flex-wrap items-center gap-2"
            role="tablist"
            aria-label="Scene workspace"
          >
            {(["preview", "code"] as const).map((value) => (
              <Button
                key={value}
                id={`motion-tab-${value}`}
                role="tab"
                aria-selected={tab === value}
                aria-controls={`motion-panel-${value}`}
                variant={tab === value ? "default" : "outline"}
                onClick={() => setTab(value)}
              >
                {value === "preview" ? "Preview" : "Scene code"}
              </Button>
            ))}
          </div>
          {tab === "preview" ? (
            <div id="motion-panel-preview" role="tabpanel" aria-labelledby="motion-tab-preview">
              {source ? (
                <MotionPreview
                  key={`${selected?.id ?? "draft"}:${source.length}`}
                  source={source}
                  spec={project.renderSpec}
                />
              ) : (
                <p className="py-16 text-center text-sm text-ink-soft">
                  No scene has been saved yet. Generate one from your brief or add a complete HTML
                  scene in the code tab.
                </p>
              )}
            </div>
          ) : (
            <div
              id="motion-panel-code"
              role="tabpanel"
              aria-labelledby="motion-tab-code"
              className="space-y-4"
            >
              <label className="block space-y-2 text-sm font-medium text-ink">
                <span>Single-file HTML scene</span>
                <textarea
                  className={`${inputClass} min-h-96 resize-y font-mono text-xs`}
                  value={source}
                  spellCheck={false}
                  maxLength={512000}
                  onChange={(event) => setSource(event.target.value)}
                  disabled={Boolean(busy)}
                  placeholder="Paste one complete HTML document with window.DURATION and window.seek(t)."
                />
              </label>
              <div aria-live="polite">
                {lint.ok ? (
                  <p className="text-sm text-success">
                    Static checks passed. Worker runtime checks still apply.
                  </p>
                ) : (
                  <ul className="space-y-1 text-sm text-danger">
                    {lint.errors.map((issue) => (
                      <li key={issue.code}>{issue.message}</li>
                    ))}
                  </ul>
                )}
              </div>
              <Button
                onClick={() => void save()}
                disabled={!lint.ok || !dirty || active}
                loading={busy === "save"}
              >
                Save a new version
              </Button>
              <p className="text-xs text-ink-mute">
                Every save creates a version. Previous source and model provenance remain intact.
              </p>
            </div>
          )}
          <section className="mt-6 border-t border-line pt-5">
            <h2 className="text-base font-semibold text-ink">Refine the scene</h2>
            <label className="mt-3 block space-y-2 text-sm text-ink-soft">
              <span>Regenerate with an instruction</span>
              <textarea
                className={`${inputClass} min-h-24`}
                value={instruction}
                maxLength={4000}
                onChange={(event) => setInstruction(event.target.value)}
                placeholder="Keep the wording, but give the final moment more breathing room."
                disabled={Boolean(busy)}
              />
            </label>
            <Button
              onClick={() => void generate()}
              className="mt-3"
              disabled={
                !capabilities.generationEnabled ||
                project.modelId === "manual" ||
                active ||
                dirty ||
                !referenceReady
              }
              loading={busy === "generate"}
            >
              {selected ? "Regenerate from saved version" : "Generate from brief"}
            </Button>
            {dirty && (
              <p className="mt-2 text-xs text-ink-soft">
                Save or discard code changes before regenerating or exporting.
              </p>
            )}
            {!capabilities.generationEnabled && (
              <p className="mt-2 text-xs text-ink-mute">
                Model generation is unavailable in this deployment.
              </p>
            )}
            {!referenceReady && (
              <p className="mt-2 text-xs text-ink-soft">
                Complete reference analysis before generating. The latest reference has not produced
                a valid motion brief yet.
              </p>
            )}
          </section>
          <section className="mt-6 space-y-4 border-t border-line pt-5">
            {referenceAvailable ? (
              <>
                <MotionReferencePicker
                  uploads={uploads}
                  selectedId={referenceId}
                  onSelect={setReferenceId}
                  rightsAccepted={referenceRights}
                  onRightsChange={setReferenceRights}
                  disabled={Boolean(busy) || active}
                />
                <Button
                  variant="outline"
                  onClick={() => void analyzeReference()}
                  loading={busy === "reference"}
                  disabled={!referenceId || !referenceRights || active || Boolean(busy)}
                >
                  Analyse reference
                </Button>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-line p-4 text-sm text-ink-soft">
                <h2 className="font-medium text-ink">
                  {capabilities.referenceEnabled
                    ? "Reference video requires a vision model"
                    : "Reference video · coming soon"}
                </h2>
                <p className="mt-2">
                  {capabilities.referenceEnabled
                    ? "Start a new project using a reference-capable model to analyse an authorised video."
                    : "Reference analysis requires a configured vision model and enabled worker lane."}
                </p>
              </div>
            )}
            {latestReference && <MotionReferenceResult analysis={latestReference} />}
          </section>
        </section>
        <aside className="min-w-0 space-y-5">
          <section className="rounded-2xl border border-line bg-surface-panel p-5">
            <h2 className="font-semibold text-ink">Frame critique</h2>
            {selected?.critiqueReport ? (
              <div className="mt-3 space-y-3 text-sm text-ink-soft">
                <p>
                  {selected.critiqueReport.rounds} critique{" "}
                  {selected.critiqueReport.rounds === 1 ? "round" : "rounds"} ·{" "}
                  {selected.critiqueReport.resolved
                    ? "model reports no outstanding issues"
                    : "review the remaining issues"}
                </p>
                {selected.critiqueReport.issues.length > 0 && (
                  <ul className="list-disc space-y-2 pl-5">
                    {selected.critiqueReport.issues.map((issue, index) => (
                      <li key={`${issue.code}:${index}`} className="break-words">
                        {issue.description}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-xs text-ink-mute">
                  Automated critique assists your review. Check the timing, text and output yourself
                  before delivery.
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-ink-soft">
                No automated critique was recorded for this version.
              </p>
            )}
          </section>
          <section className="rounded-2xl border border-line bg-surface-panel p-5">
            <h2 className="font-semibold text-ink">Versions</h2>
            {versions.length === 0 ? (
              <p className="mt-3 text-sm text-ink-soft">No saved version yet.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {versions.map((version, index) => (
                  <button
                    type="button"
                    key={version.id}
                    onClick={() => loadVersion(version.id)}
                    aria-pressed={selected?.id === version.id}
                    className={`min-h-11 w-full rounded-lg border p-3 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember ${selected?.id === version.id ? "border-line-strong bg-surface-sunken" : "border-line"}`}
                  >
                    <span className="block font-medium text-ink">
                      Version {versions.length - index}
                    </span>
                    <span className="mt-1 block break-words text-xs text-ink-mute">
                      {version.modelUsed ?? "Manual edit"} ·{" "}
                      {new Intl.DateTimeFormat("en", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "UTC",
                      }).format(new Date(version.createdAt))}{" "}
                      UTC
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
          <section className="rounded-2xl border border-line bg-surface-panel p-5">
            <h2 className="font-semibold text-ink">Export queue</h2>
            <p className="mt-2 text-xs text-ink-soft">
              Plan limits and watermarking are independently enforced by the worker. Each export
              reserves its duration in render seconds.
            </p>
            <Button
              onClick={() => void render()}
              className="mt-4 w-full"
              disabled={
                !capabilities.renderEnabled || !selected || !savedLint?.ok || dirty || active
              }
              loading={busy === "render"}
            >
              Export MP4
            </Button>
            {!capabilities.renderEnabled && (
              <p className="mt-2 text-xs text-ink-mute">
                MP4 rendering is coming soon in this deployment.
              </p>
            )}
            <ul className="mt-4 space-y-3">
              {renders.map((item) => (
                <li key={item.id} className="rounded-lg border border-line p-3 text-sm">
                  <p className="capitalize text-ink">
                    {item.status.replaceAll("_", " ")} {item.watermarked ? "· watermarked" : ""}
                  </p>
                  {item.status !== "ready" && item.status !== "failed" && (
                    <progress
                      className="mt-2 w-full accent-ember"
                      aria-label="Render progress"
                      value={item.progress}
                      max={1}
                    />
                  )}
                  {item.errorCode && (
                    <p className="mt-1 text-xs text-danger">
                      {item.errorCode.replaceAll("_", " ")}
                    </p>
                  )}
                  {item.status === "ready" && (
                    <Button
                      variant="outline"
                      className="mt-2 w-full"
                      loading={busy === `download:${item.id}`}
                      disabled={Boolean(busy)}
                      onClick={() => void download(item.id)}
                    >
                      Download MP4
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </section>
          {activeTasks.length > 0 && (
            <section className="rounded-2xl border border-line bg-surface-panel p-5">
              <h2 className="font-semibold text-ink">Active work</h2>
              <ul className="mt-3 space-y-3">
                {activeTasks.map((task) => (
                  <li key={task.id} className="text-sm">
                    <p className="capitalize text-ink-soft">
                      {task.type.replaceAll("_", " ")} · {task.status}
                    </p>
                    <Button
                      variant="outline"
                      className="mt-2"
                      disabled={Boolean(busy)}
                      onClick={() =>
                        void run(`cancel:${task.id}`, async () => {
                          await cancelMotionTask({ data: { taskId: task.id } });
                          setNotice("Cancellation requested. The worker will stop safely.");
                        })
                      }
                    >
                      Cancel task
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="rounded-2xl border border-dashed border-line p-5 text-sm text-ink-soft">
            <h2 className="font-semibold text-ink">Coming soon</h2>
            <p className="mt-2">Opt-in share links.</p>
            <Button asChild variant="outline" className="mt-3 w-full">
              <Link to="/app/motion/gallery">Community gallery</Link>
            </Button>
          </section>
        </aside>
      </div>
    </div>
  );
}
