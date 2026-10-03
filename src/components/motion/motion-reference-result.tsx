import { referenceMotionBriefSchema } from "@/domain/motion/reference-brief";
export type MotionReferenceAnalysisView = {
  id: string;
  status: string;
  brief: unknown;
  modelUsed: string | null;
  errorCode: string | null;
  createdAt: string;
};
export function MotionReferenceResult({ analysis }: { analysis: MotionReferenceAnalysisView }) {
  const parsed = referenceMotionBriefSchema.safeParse(analysis.brief);
  if (analysis.status !== "ready")
    return (
      <div
        role={analysis.status === "failed" ? "alert" : "status"}
        className={`rounded-lg border border-line p-3 text-sm ${analysis.status === "failed" ? "text-danger" : "text-ink-soft"}`}
      >
        <p>Reference analysis: {analysis.status}.</p>
        <p className="mt-1">
          {analysis.status === "failed"
            ? `${analysis.errorCode?.replaceAll("_", " ") ?? "The worker could not analyse this reference"}. Choose a reference and retry.`
            : analysis.status === "cancelled"
              ? "Analysis was cancelled. Choose a reference and retry before generating."
              : "Generation waits until the motion brief is ready. You can leave this page while the worker processes it."}
        </p>
      </div>
    );
  if (!parsed.success)
    return (
      <p role="alert" className="text-sm text-danger">
        The saved reference brief is invalid. Analyse the reference again before generating.
      </p>
    );
  const brief = parsed.data;
  return (
    <section
      aria-label="Analysed motion brief"
      className="space-y-3 rounded-xl border border-line bg-surface-sunken p-4 text-sm text-ink-soft"
    >
      <h3 className="font-semibold text-ink">Reference motion brief</h3>
      <p className="text-xs text-ink-mute">
        Analysed by {analysis.modelUsed ?? "the configured vision model"}. The next generation uses
        these principles together with your original brief.
      </p>
      <dl className="space-y-2">
        <div>
          <dt className="font-medium text-ink">Pacing</dt>
          <dd className="capitalize">
            {brief.pacing} · {brief.cutsPerSecond} cuts per second
          </dd>
        </div>
        <div>
          <dt className="font-medium text-ink">Palette</dt>
          <dd className="break-words font-mono text-xs">{brief.palette.join(" · ")}</dd>
        </div>
        <div>
          <dt className="font-medium text-ink">Typography</dt>
          <dd className="break-words">{brief.typography}</dd>
        </div>
        <div>
          <dt className="font-medium text-ink">Transitions</dt>
          <dd>
            {brief.transitionTypes.length
              ? brief.transitionTypes.join(" · ")
              : "No transition pattern identified."}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-ink">Beat timings</dt>
          <dd className="font-mono text-xs">
            {brief.beatTimings.length
              ? brief.beatTimings.map((time) => `${time}s`).join(" · ")
              : "No distinct beat timings identified."}
          </dd>
        </div>
      </dl>
      {brief.principles.length > 0 && (
        <div>
          <h4 className="font-medium text-ink">Principles to adapt</h4>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {brief.principles.map((principle, index) => (
              <li key={index} className="break-words">
                {principle}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
