import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { FileVideo, Search, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { SourceUpload } from "@/components/youtube-clipper/source-upload";
import { getProject } from "@/services/projects/server";
import { createClipJob } from "@/services/clipping/server";
import { userFacingError } from "@/lib/user-facing-error";

export const Route = createFileRoute("/_authenticated/app/projects/$projectId/media")({
  loader: ({ params }) => getProject({ data: { projectId: params.projectId } }),
  component: MediaPage,
});

function MediaPage() {
  const { project, assets } = Route.useLoaderData();
  const router = useRouter();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [rights, setRights] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const filtered = useMemo(
    () =>
      assets.filter((asset) =>
        [asset.display_name, asset.mime_type, asset.status].some((value) =>
          value?.toLowerCase().includes(query.toLowerCase()),
        ),
      ),
    [assets, query],
  );
  const chosen = assets.find((asset) => asset.id === selected);
  const process = async () => {
    if (!chosen || !rights) return;
    setBusy(true);
    setError(null);
    try {
      const result = await createClipJob({
        data: {
          projectId: project.id,
          sourceType: "local_upload",
          sourceUrl: null,
          sourceIdentifier: null,
          sourceDurationSeconds: Math.max(1, Math.ceil(Number(chosen.duration_seconds || 0))),
          sourceAssetId: chosen.id,
          sourceMetadata: { title: chosen.display_name },
          settings: {
            language: "auto",
            contentType: "Video",
            targetPlatforms: ["youtube_shorts", "instagram_reels", "tiktok"],
            aspectRatios: [project.aspect],
            durationRange: "30–60 seconds",
            captionPreset: "Clean editorial",
            instruction: project.brief || "Keep each clip understandable without prior context.",
            autoCrop: "centre",
            removeLongPauses: true,
            removeFillerWords: false,
          },
          requestedClipCount: 5,
          rightsAccepted: true,
          idempotencyKey: crypto.randomUUID(),
        },
      });
      await navigate({ to: "/app/youtube-clipper/jobs/$jobId", params: { jobId: result.jobId } });
    } catch (cause) {
      setError(userFacingError(cause, "Processing could not be started. Try again."));
      setBusy(false);
    }
  };
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-surface-panel p-5">
        <h2 className="font-display text-xl text-ink">Upload project media</h2>
        <p className="mt-1 mb-4 text-sm text-ink-soft">
          Video files upload resumably to private storage. The worker validates the real codec and
          streams before processing.
        </p>
        <SourceUpload projectId={project.id} onUploaded={() => void router.invalidate()} />
      </section>
      <div className="flex flex-wrap gap-2">
        <label className="relative min-w-[240px] flex-1">
          <span className="sr-only">Search project media</span>
          <Search
            aria-hidden="true"
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            name="media-search"
            autoComplete="off"
            placeholder="Search filenames or status…"
            className="min-h-11 w-full rounded-md border border-line bg-surface-panel pl-10 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ember"
          />
        </label>
      </div>
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line px-5 py-12 text-center text-sm text-ink-mute">
          No uploaded media matches this search.
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((asset) => (
            <li
              key={asset.id}
              className={`rounded-xl border bg-surface-panel p-4 ${selected === asset.id ? "border-ember ring-2 ring-ember/15" : "border-line"}`}
            >
              <button
                type="button"
                onClick={() => setSelected(asset.id)}
                className="min-h-11 w-full text-left"
                aria-pressed={selected === asset.id}
              >
                <div className="flex items-center gap-2">
                  <FileVideo aria-hidden="true" className="h-4 w-4 text-ember" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                    {asset.display_name}
                  </span>
                </div>
                <div className="mt-2 text-xs text-ink-mute">
                  {asset.mime_type || "Video"} ·{" "}
                  {(Number(asset.size_bytes || 0) / 1024 / 1024).toFixed(1)} MB ·{" "}
                  {Math.ceil(Number(asset.duration_seconds || 0))}s
                </div>
                <div className="mt-2 text-xs capitalize text-success">{asset.status}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {chosen && (
        <section className="rounded-2xl border border-line bg-surface-panel p-5">
          <h2 className="font-display text-lg text-ink">Process selected video</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Create real transcript, analysis, clip candidates and previews with the deployed worker.
          </p>
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl bg-surface-raised p-3">
            <input
              type="checkbox"
              checked={rights}
              onChange={(event) => setRights(event.target.checked)}
              className="mt-1 h-4 w-4 accent-[var(--ember)]"
            />
            <span className="text-sm text-ink">
              I own this media or have permission to process and export it.
            </span>
          </label>
          <Button
            className="mt-4"
            disabled={!rights || !Number(chosen.duration_seconds)}
            onClick={() => void process()}
            loading={busy}
            loadingText="Starting worker…"
          >
            <Sparkles />
            Create AI clips
          </Button>
          {!Number(chosen.duration_seconds) && (
            <p className="mt-2 text-xs text-warning">
              The video duration is still being read. Re-upload if it remains unavailable.
            </p>
          )}
          {error && (
            <p role="alert" className="mt-3 text-sm text-danger">
              {error}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
