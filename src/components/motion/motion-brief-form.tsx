import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  createMotionProject,
  generateMotionVersion,
  getMotionCapabilities,
  getMotionUsage,
  analyzeMotionReference,
} from "@/services/motion/server";
import { MotionReferencePicker, type MotionReferenceUploads } from "./motion-reference-picker";
import { clearMotionDraft, readMotionDraft } from "@/services/motion/draft";
import type { MotionRenderSpec } from "@/domain/motion/types";
import { userFacingError } from "@/lib/user-facing-error";

type Props = {
  capabilities: Awaited<ReturnType<typeof getMotionCapabilities>>;
  usage: Awaited<ReturnType<typeof getMotionUsage>>;
  draftId?: string;
  uploads?: MotionReferenceUploads;
};
const inputClass =
  "min-h-11 w-full rounded-lg border border-line bg-surface-panel px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ember";

export function MotionBriefForm({ capabilities, usage, draftId, uploads = [] }: Props) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [modelId, setModelId] = useState(capabilities.models[0]?.id ?? "manual");
  const [aspect, setAspect] = useState<MotionRenderSpec["aspect"]>("16:9");
  const [duration, setDuration] = useState(8);
  const [fps, setFps] = useState<MotionRenderSpec["fps"]>(30);
  const [preset, setPreset] = useState("auto");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [referenceId, setReferenceId] = useState("");
  const [referenceRights, setReferenceRights] = useState(false);
  const referenceKey = useRef<string | null>(null);
  const sourcePromptId = useRef<string | undefined>(undefined);
  const retryKey = useRef<string | null>(null);
  const generationKey = useRef<string | null>(null);
  const fingerprint = useRef<string | null>(null);
  const createdProject = useRef<string | null>(null);
  const maxDuration = usage.entitlement.maxMotionSecondsPerVideo;
  const referenceAvailable = capabilities.referenceEnabled && capabilities.models.some((model) => model.id === modelId && model.supportsVision);

  useEffect(() => {
    const draft = readMotionDraft(draftId);
    if (!draft) return;
    setPrompt(draft.prompt);
    setAspect(draft.aspect);
    setDuration(Math.min(maxDuration, Math.max(1, draft.durationSeconds)));
    if ([24, 30, 60].includes(draft.fps ?? 30))
      setFps(
        Math.min(
          draft.fps ?? 30,
          usage.entitlement.maxMotionResolution.fps,
        ) as MotionRenderSpec["fps"],
      );
    sourcePromptId.current = draft.sourcePromptId;
  }, [draftId, maxDuration, usage.entitlement.maxMotionResolution.fps]);

  const create = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || (referenceId && !referenceRights)) return;
    setBusy(true);
    setError(null);
    const currentFingerprint = JSON.stringify({
      title,
      prompt,
      modelId,
      aspect,
      duration,
      fps,
      referenceId,
    });
    if (!createdProject.current && fingerprint.current !== currentFingerprint) {
      retryKey.current = crypto.randomUUID();
      fingerprint.current = currentFingerprint;
    }
    retryKey.current ??= crypto.randomUUID();
    generationKey.current ??= crypto.randomUUID();
    referenceKey.current ??= crypto.randomUUID();
    try {
      const maxSide = Math.min(
        usage.entitlement.maxMotionResolution.width,
        usage.entitlement.maxMotionResolution.height,
      );
      const size =
        aspect === "16:9"
          ? { width: (maxSide * 16) / 9, height: maxSide }
          : aspect === "9:16"
            ? { width: maxSide, height: (maxSide * 16) / 9 }
            : { width: maxSide, height: maxSide };
      const even = (value: number) => Math.floor(value / 2) * 2;
      const renderSpec: MotionRenderSpec = {
        width: even(size.width),
        height: even(size.height),
        aspect,
        fps,
        durationSeconds: duration,
      };
      if (!createdProject.current) {
        const result = await createMotionProject({
          data: {
            title: title.trim() || "Untitled motion",
            prompt,
            modelId,
            renderSpec,
            sourcePromptId: sourcePromptId.current,
            idempotencyKey: retryKey.current,
          },
        });
        createdProject.current = result.projectId;
      }
      if (referenceId && referenceAvailable)
        await analyzeMotionReference({
          data: {
            projectId: createdProject.current,
            mediaAssetId: referenceId,
            rightsAccepted: true,
            idempotencyKey: referenceKey.current,
          },
        });
      else if (modelId !== "manual")
        await generateMotionVersion({
          data: {
            projectId: createdProject.current,
            idempotencyKey: generationKey.current,
          },
        });
      clearMotionDraft(draftId);
      await navigate({
        to: "/app/motion/$projectId",
        params: { projectId: createdProject.current },
      });
    } catch (cause) {
      setError(
        userFacingError(cause, "The project could not be started. Your brief is still here."),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={(event) => void create(event)}
      className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]"
    >
      <section className="min-w-0 space-y-5 rounded-2xl border border-line bg-surface-panel p-4 sm:p-6">
        <label className="block space-y-2 text-sm font-medium text-ink">
          <span>Project title</span>
          <input
            className={inputClass}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            placeholder="A name you will recognise"
            disabled={busy || Boolean(createdProject.current)}
          />
        </label>
        <label className="block space-y-2 text-sm font-medium text-ink">
          <span>Your motion brief</span>
          <textarea
            className={`${inputClass} min-h-64 resize-y`}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            minLength={10}
            maxLength={12000}
            required
            disabled={busy || Boolean(createdProject.current)}
            placeholder={
              "Tell one story. Include exact text in quotes, real data, the mood, and how the pacing should feel."
            }
          />
        </label>
        <p className="text-xs text-ink-mute">
          {prompt.length.toLocaleString()} / 12,000 characters. Text and facts you supply are sent
          to the selected model.
        </p>
        <label className="block space-y-2 text-sm font-medium text-ink">
          <span>Model</span>
          <select
            className={inputClass}
            value={modelId}
          onChange={(event) => { setModelId(event.target.value); setReferenceId(""); setReferenceRights(false); referenceKey.current = null; }}
            disabled={busy || Boolean(createdProject.current)}
            required
          >
            <option value="manual">Write or paste scene code manually</option>
            {capabilities.models.map((model) => (
              <option key={model.id} value={model.id}>
              {model.label}{model.supportsVision ? " · reference capable" : ""}
              </option>
            ))}
          </select>
        </label>
        {!capabilities.generationEnabled && (
          <p
            role="status"
            className="rounded-xl border border-line bg-surface-sunken p-3 text-sm text-ink-soft"
          >
            Generation is coming soon in this deployment.{" "}
            {capabilities.reason ?? "A configured model and motion worker are required."}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block space-y-2 text-sm font-medium text-ink">
            <span>Aspect ratio</span>
            <select
              className={inputClass}
              value={aspect}
              onChange={(event) => setAspect(event.target.value as MotionRenderSpec["aspect"])}
              disabled={busy || Boolean(createdProject.current)}
            >
              {["16:9", "1:1", "9:16"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-2 text-sm font-medium text-ink">
            <span>Duration (seconds)</span>
            <input
              className={inputClass}
              type="number"
              min={1}
              max={maxDuration}
              step={1}
              required
              value={duration}
              onChange={(event) => setDuration(Number(event.target.value))}
              disabled={busy || Boolean(createdProject.current)}
            />
          </label>
          <label className="block space-y-2 text-sm font-medium text-ink">
            <span>Frames per second</span>
            <select
              className={inputClass}
              value={fps}
              onChange={(event) => setFps(Number(event.target.value) as MotionRenderSpec["fps"])}
              disabled={busy || Boolean(createdProject.current)}
            >
              {[24, 30, 60]
                .filter((value) => value <= usage.entitlement.maxMotionResolution.fps)
                .map((value) => (
                  <option key={value}>{value}</option>
                ))}
            </select>
          </label>
        </div>
        <label className="block space-y-2 text-sm font-medium text-ink">
          <span>Inspiration</span>
          <select
            className={inputClass}
            value={preset}
            onChange={(event) => setPreset(event.target.value)}
          >
            <option value="auto">Auto — let the brief guide the style</option>
          </select>
        </label>
        {referenceAvailable ? (
          <MotionReferencePicker
            uploads={uploads}
            selectedId={referenceId}
            onSelect={setReferenceId}
            rightsAccepted={referenceRights}
            onRightsChange={setReferenceRights}
            disabled={busy || Boolean(createdProject.current)}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-line p-4">
            <h2 className="text-sm font-medium text-ink">{capabilities.referenceEnabled ? "Reference video requires a vision model" : "Reference video · coming soon"}</h2>
            <p className="mt-2 text-sm text-ink-soft">
              {capabilities.referenceEnabled ? "Choose a reference-capable model above to analyse an authorised video." : "Reference analysis is unavailable until a vision model and worker lane are configured."}
            </p>
            <Button type="button" disabled variant="outline" className="mt-3">
              Add a reference
            </Button>
          </div>
        )}
        {error && (
          <div role="alert" className="space-y-2 text-sm text-danger">
            <p>{error}</p>
            {createdProject.current && (
              <p>
                A private project was saved. Retry to enqueue{" "}
                {referenceId ? "reference analysis" : "generation"}, or open it from Motion Studio.
              </p>
            )}
          </div>
        )}
        <Button
          type="submit"
          loading={busy}
          loadingText="Starting your project…"
          disabled={
            capabilities.availability === "coming_soon" ||
            (Boolean(referenceId) && !referenceRights) ||
            (modelId !== "manual" && !capabilities.generationEnabled)
          }
        >
          {referenceId
            ? "Analyse reference first"
            : modelId === "manual"
              ? "Create a code project"
              : "Make one from scratch"}
        </Button>
      </section>
      <aside className="space-y-4">
        <section className="rounded-2xl border border-line bg-surface-panel p-5">
          <h2 className="font-semibold text-ink">Your plan</h2>
          <p className="mt-3 text-sm text-ink-soft">
            {usage.entitlement.maxMotionResolution.height}p · up to {maxDuration}s per video
            {usage.entitlement.motionWatermarkRequired ? " · Vidrial watermark" : ""}
          </p>
          <p className="mt-2 text-sm text-ink-soft">
            {Math.max(
              0,
              usage.limitSeconds - usage.committedSeconds - usage.reservedSeconds,
            ).toLocaleString()}{" "}
            render seconds remaining this period.
          </p>
        </section>
        <section className="rounded-2xl border border-line bg-surface-sunken p-5">
          <h2 className="font-semibold text-ink">A useful brief</h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            Give the piece a beginning, a change and an ending. State exact words and verified
            numbers. Describe the feeling of the timing; let the model choose how to express it.
          </p>
          <p className="mt-3 text-xs text-ink-mute">
            Model generation and MP4 rendering are separate steps. Review the scene before spending
            render seconds.
          </p>
        </section>
      </aside>
    </form>
  );
}
