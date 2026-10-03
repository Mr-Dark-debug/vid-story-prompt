import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { MotionProject, MotionVersion } from "@/domain/motion/types";
import { MOTION_CATEGORIES } from "@/domain/motion/categories";
import { getMotionProject, publishMotionPrompt } from "@/services/motion/server";
import { userFacingError } from "@/lib/user-facing-error";

const inputClass =
  "min-h-11 w-full rounded-lg border border-line bg-surface-panel px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ember";
export function MotionPublishForm({
  projects,
  enabled,
}: {
  projects: MotionProject[];
  enabled: boolean;
}) {
  const [projectId, setProjectId] = useState("");
  const [versions, setVersions] = useState<MotionVersion[]>([]);
  const [versionId, setVersionId] = useState("");
  const [category, setCategory] = useState<string>(MOTION_CATEGORIES[0].slug);
  const [license, setLicense] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const project = projects.find((item) => item.id === projectId);
  useEffect(() => {
    let live = true;
    setVersions([]);
    setVersionId("");
    setError(null);
    setSubmitted(false);
    if (!projectId) return;
    setLoading(true);
    void getMotionProject({ data: { projectId } })
      .then((detail) => {
        if (live) {
          setVersions(detail.versions);
          setVersionId(detail.versions[0]?.id ?? "");
        }
      })
      .catch((cause) => {
        if (live) setError(userFacingError(cause, "Saved versions could not be loaded."));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [projectId]);
  return (
    <form
      className="mt-5 max-w-2xl space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!project || !license || !versionId || busy) return;
        setBusy(true);
        setError(null);
        try {
          await publishMotionPrompt({
            data: {
              projectId,
              versionId,
              title: project.title,
              prompt: project.prompt,
              category,
              licenseGranted: true,
            },
          });
          setSubmitted(true);
        } catch (cause) {
          setError(userFacingError(cause, "The submission could not be saved."));
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="block space-y-2 text-sm text-ink">
        <span>Project</span>
        <select
          className={inputClass}
          value={projectId}
          onChange={(event) => setProjectId(event.target.value)}
          disabled={busy || !enabled}
          required
        >
          <option value="">Choose your project</option>
          {projects.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-2 text-sm text-ink">
        <span>Saved version</span>
        <select
          className={inputClass}
          value={versionId}
          onChange={(event) => setVersionId(event.target.value)}
          disabled={busy || loading || !versions.length}
          required
        >
          <option value="">{loading ? "Loading saved versions…" : "Choose a version"}</option>
          {versions.map((item, index) => (
            <option key={item.id} value={item.id}>
              Version {versions.length - index} · {item.modelUsed ?? "manual edit"}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-2 text-sm text-ink">
        <span>Category</span>
        <select
          className={inputClass}
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          disabled={busy}
        >
          {MOTION_CATEGORIES.map((item) => (
            <option key={item.slug} value={item.slug}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-h-11 items-start gap-3 text-sm leading-relaxed text-ink-soft">
        <input
          className="mt-1 h-4 w-4 shrink-0 accent-ember"
          type="checkbox"
          checked={license}
          onChange={(event) => setLicense(event.target.checked)}
          disabled={busy}
          required
        />
        <span>
          I own or am authorised to share this prompt, scene and its assets. I grant Vidrial a
          non-exclusive license to publish this submission and allow users to copy and adapt its
          prompt. I understand that the approved prompt and preview will be public.
        </span>
      </label>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {submitted && (
        <p role="status" className="text-sm text-success">
          Submitted for moderation. Your prompt is pending review and is not public yet.
        </p>
      )}
      <Button
        type="submit"
        loading={busy}
        disabled={!enabled || !license || !versionId || submitted || loading}
      >
        Submit for moderation
      </Button>
      {!enabled && (
        <p className="text-xs text-ink-mute">
          Gallery submissions are coming soon in this deployment.
        </p>
      )}
      {enabled && !projects.length && (
        <p className="text-xs text-ink-mute">Save a motion project before submitting it.</p>
      )}
    </form>
  );
}
