import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileVideo,
  Heart,
  Link2,
  MonitorPlay,
  Youtube,
} from "lucide-react";
import { SourceUpload, type UploadedSource } from "./source-upload";
import { getYouTubeMetadata } from "@/services/youtube/server";
import { parseYouTubeVideoId } from "@/services/youtube/parser";
import { createClipJob } from "@/services/clipping/server";
import { attachSourceToAutomationDraft } from "@/services/youtube/automation.server";

type YouTubeMetadata = Awaited<ReturnType<typeof getYouTubeMetadata>>;
const steps = ["Video source", "Clip preferences", "Review"];

export function JobWizard({
  initialYoutube = "",
  initialSource = "",
  initialDraft,
}: {
  initialYoutube?: string;
  initialSource?: string;
  initialDraft?: string;
}) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [sourceMode, setSourceMode] = useState<"youtube" | "upload" | "direct">(
    initialSource === "upload" ? "upload" : "youtube",
  );
  const [youtubeUrl, setYoutubeUrl] = useState(initialYoutube);
  const [directUrl, setDirectUrl] = useState("");
  const [directDuration, setDirectDuration] = useState(0);
  const [metadata, setMetadata] = useState<YouTubeMetadata | null>(null);
  const [uploaded, setUploaded] = useState<UploadedSource | null>(null);
  const [rights, setRights] = useState(false);
  const [requestedClips, setRequestedClips] = useState(5);
  const [durationRange, setDurationRange] = useState("30–60 seconds");
  const [language, setLanguage] = useState("auto");
  const [contentType, setContentType] = useState("Podcast");
  const [captionPreset, setCaptionPreset] = useState("Clean editorial");
  const [instruction, setInstruction] = useState(
    "Keep each clip understandable without prior context.",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sourceMode !== "youtube" || !youtubeUrl.trim()) return;
    let videoId: string;
    try {
      videoId = parseYouTubeVideoId(youtubeUrl);
    } catch {
      return;
    }
    if (metadata?.videoId === videoId) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setBusy(true);
      setError(null);
      void getYouTubeMetadata({ data: { url: youtubeUrl } })
        .then((value) => {
          if (active) setMetadata(value);
        })
        .catch((cause) => {
          if (active)
            setError(cause instanceof Error ? cause.message : "YouTube details are unavailable.");
        })
        .finally(() => {
          if (active) setBusy(false);
        });
    }, 500);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [metadata?.videoId, sourceMode, youtubeUrl]);

  const analyseYoutube = async () => {
    setBusy(true);
    setError(null);
    try {
      const value = await getYouTubeMetadata({ data: { url: youtubeUrl } });
      setMetadata(value);
      return value;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "YouTube details are unavailable.");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const next = async () => {
    if (step === 0 && sourceMode === "youtube" && !metadata && !(await analyseYoutube())) return;
    if (step === 0 && sourceMode === "direct" && (!directUrl || directDuration <= 0)) {
      setError("Add the authorised HTTPS media URL and its expected duration.");
      return;
    }
    if (step === 0 && sourceMode !== "direct" && !uploaded) {
      setError("Add the source media file before continuing.");
      return;
    }
    if (step === 0 && !rights) {
      setError("Confirm your rights before creating a processing job.");
      return;
    }
    setError(null);
    setStep((value) => Math.min(2, value + 1));
  };
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!rights) throw new Error("Confirm your rights before creating a processing job.");
      if (sourceMode !== "direct" && !uploaded)
        throw new Error("Add the source media file before creating the job.");
      if (initialDraft && uploaded) {
        const automated = await attachSourceToAutomationDraft({
          data: {
            draftId: initialDraft,
            mediaAssetId: uploaded.assetId,
            rightsAccepted: true,
          },
        });
        await navigate({
          to: "/app/youtube-clipper/jobs/$jobId",
          params: { jobId: automated.jobId },
        });
        return;
      }
      const sourceDuration =
        uploaded?.durationSeconds || metadata?.durationSeconds || directDuration;
      if (!sourceDuration)
        throw new Error("Source duration is required for plan and usage enforcement.");
      const result = await createClipJob({
        data: {
          sourceType:
            sourceMode === "direct"
              ? "direct_owned_media_url"
              : sourceMode === "youtube"
                ? "youtube_metadata"
                : "local_upload",
          sourceUrl:
            sourceMode === "direct" ? directUrl : sourceMode === "youtube" ? youtubeUrl : null,
          sourceIdentifier: metadata?.videoId ?? null,
          sourceDurationSeconds: sourceDuration,
          sourceAssetId: uploaded?.assetId ?? null,
          sourceMetadata: {
            title: metadata?.title ?? uploaded?.filename ?? "Authorised source",
            channelId: metadata?.channelId,
            channelTitle: metadata?.channelTitle,
            thumbnailUrl: metadata?.thumbnailUrl,
          },
          settings: {
            language,
            contentType,
            targetPlatforms: ["youtube_shorts", "instagram_reels", "tiktok"],
            aspectRatios: ["9:16"],
            durationRange,
            captionPreset,
            instruction,
            autoCrop: "centre",
            removeLongPauses: true,
            removeFillerWords: false,
          },
          requestedClipCount: requestedClips,
          rightsAccepted: true,
          idempotencyKey: crypto.randomUUID(),
        },
      });
      await navigate({ to: "/app/youtube-clipper/jobs/$jobId", params: { jobId: result.jobId } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The job could not be created.");
      setBusy(false);
    }
  };

  return (
    <div>
      <ol className="mb-8 grid grid-cols-3 gap-2">
        {steps.map((label, index) => (
          <li key={label} className="min-w-0">
            <div className={`h-1 rounded-full ${index <= step ? "bg-ember" : "bg-line"}`} />
            <div
              className={`mt-2 truncate text-[11px] ${index === step ? "font-semibold text-ink" : "text-ink-mute"}`}
            >
              {index + 1}. {label}
            </div>
          </li>
        ))}
      </ol>
      <div className="rounded-3xl border border-line bg-surface-panel p-5 sm:p-7">
        {step === 0 && (
          <SourceStep
            mode={sourceMode}
            setMode={(mode) => {
              setSourceMode(mode);
              setUploaded(null);
              setError(null);
            }}
            youtubeUrl={youtubeUrl}
            setYoutubeUrl={(value) => {
              setYoutubeUrl(value);
              setMetadata(null);
            }}
            busy={busy}
            metadata={metadata}
            directUrl={directUrl}
            setDirectUrl={setDirectUrl}
            directDuration={directDuration}
            setDirectDuration={setDirectDuration}
            setUploaded={setUploaded}
            rights={rights}
            setRights={setRights}
          />
        )}
        {step === 1 && (
          <Preferences
            requestedClips={requestedClips}
            setRequestedClips={setRequestedClips}
            durationRange={durationRange}
            setDurationRange={setDurationRange}
            language={language}
            setLanguage={setLanguage}
            contentType={contentType}
            setContentType={setContentType}
            captionPreset={captionPreset}
            setCaptionPreset={setCaptionPreset}
            instruction={instruction}
            setInstruction={setInstruction}
          />
        )}
        {step === 2 && (
          <Review
            metadata={metadata}
            uploaded={uploaded}
            sourceMode={sourceMode}
            directUrl={directUrl}
            sourceSeconds={uploaded?.durationSeconds || metadata?.durationSeconds || directDuration}
            requestedClips={requestedClips}
            durationRange={durationRange}
            captionPreset={captionPreset}
          />
        )}
        {error && (
          <div
            role="alert"
            className="mt-5 rounded-xl border border-danger/25 bg-danger/5 px-4 py-3 text-sm text-danger"
          >
            {error}
          </div>
        )}
        <div className="mt-7 flex justify-between border-t border-line pt-5">
          <button
            type="button"
            disabled={step === 0}
            onClick={() => setStep((value) => Math.max(0, value - 1))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm text-ink disabled:opacity-0"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
          {step < 2 ? (
            <button
              type="button"
              disabled={busy}
              aria-busy={busy || undefined}
              onClick={() => void next()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-surface-page hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember disabled:cursor-wait disabled:opacity-60"
            >
              {step === 0 && sourceMode === "youtube" && busy ? "Loading details…" : "Continue"}
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={submit}
              className="inline-flex items-center gap-2 rounded-lg bg-ember px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60"
            >
              {busy ? "Creating job…" : "Create clipping job"}
              <Check className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SourceStep(props: {
  mode: "youtube" | "upload" | "direct";
  setMode: (mode: "youtube" | "upload" | "direct") => void;
  youtubeUrl: string;
  setYoutubeUrl: (value: string) => void;
  busy: boolean;
  metadata: YouTubeMetadata | null;
  directUrl: string;
  setDirectUrl: (value: string) => void;
  directDuration: number;
  setDirectDuration: (value: number) => void;
  setUploaded: (value: UploadedSource) => void;
  rights: boolean;
  setRights: (value: boolean) => void;
}) {
  const modes = [
    {
      key: "youtube" as const,
      icon: Youtube,
      title: "YouTube URL",
      body: "Public details without connecting an account",
    },
    {
      key: "upload" as const,
      icon: FileVideo,
      title: "Upload original",
      body: "Resumable private source upload",
    },
    {
      key: "direct" as const,
      icon: Link2,
      title: "Owned media URL",
      body: "HTTPS source checked against SSRF",
    },
  ];
  return (
    <div>
      <h2 className="font-display text-2xl text-ink">Choose the video source</h2>
      <p className="mt-2 text-sm text-ink-soft">
        Paste a YouTube link to load its public details automatically. A YouTube account connection
        is not required for clipping.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {modes.map((mode) => (
          <button
            key={mode.key}
            type="button"
            aria-pressed={props.mode === mode.key}
            onClick={() => props.setMode(mode.key)}
            className={`rounded-2xl border p-4 text-left transition-colors hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember ${props.mode === mode.key ? "border-ember bg-ember-soft/40" : "border-line bg-surface-raised"}`}
          >
            <mode.icon className="h-5 w-5 text-ember" />
            <div className="mt-4 text-sm font-semibold text-ink">{mode.title}</div>
            <div className="mt-1 text-xs text-ink-mute">{mode.body}</div>
          </button>
        ))}
      </div>
      {props.mode === "youtube" && (
        <div className="mt-5">
          <label className="grid gap-1.5 text-xs font-medium text-ink" htmlFor="youtube-source-url">
            YouTube video link
            <input
              id="youtube-source-url"
              name="youtubeSourceUrl"
              type="url"
              autoComplete="off"
              spellCheck={false}
              value={props.youtubeUrl}
              onChange={(event) => props.setYoutubeUrl(event.target.value)}
              placeholder="https://youtube.com/watch?v=…"
              className="h-12 min-w-0 rounded-xl border border-line bg-surface-page px-4 text-sm font-normal outline-none focus:border-ember focus-visible:ring-2 focus-visible:ring-ember/20"
            />
          </label>
          <div className="mt-2 flex min-h-5 items-center justify-between gap-3 text-xs text-ink-mute">
            <span>Details load after a valid link is pasted.</span>
            {props.busy ? <span role="status">Loading video details…</span> : null}
          </div>
          {props.metadata && (
            <article className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface-raised sm:grid sm:grid-cols-[minmax(15rem,2fr)_3fr]">
              <div className="relative aspect-video bg-surface-sunken">
                <img
                  src={props.metadata.thumbnailUrl}
                  alt={`Thumbnail for ${props.metadata.title}`}
                  width={480}
                  height={270}
                  className="h-full w-full object-cover"
                />
                <span className="absolute bottom-2 right-2 rounded bg-black/85 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white">
                  {formatDuration(props.metadata.durationSeconds)}
                </span>
              </div>
              <div className="min-w-0 p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#ff0033] text-white">
                    <Youtube className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-ink sm:text-base">
                      {props.metadata.title}
                    </h3>
                    <p className="mt-1 truncate text-xs text-ink-mute">
                      {props.metadata.channelTitle}
                    </p>
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <MetadataStat
                    icon={Eye}
                    label="Views"
                    value={formatCount(props.metadata.viewCount)}
                  />
                  <MetadataStat
                    icon={Heart}
                    label="Likes"
                    value={
                      props.metadata.likeCount ? formatCount(props.metadata.likeCount) : "Hidden"
                    }
                  />
                  <MetadataStat
                    icon={MonitorPlay}
                    label="Quality"
                    value={`${props.metadata.definition.toUpperCase()} · ${props.metadata.dimension.toUpperCase()}`}
                  />
                  <MetadataStat
                    icon={CalendarDays}
                    label="Published"
                    value={formatPublishedDate(props.metadata.publishedAt)}
                  />
                </dl>
                <div className="mt-4 rounded-lg bg-surface-sunken px-3 py-2 text-xs leading-5 text-ink-soft">
                  Public video details loaded. Add the media file below so Vidrial can process the
                  clips without requesting access to your YouTube account.
                </div>
              </div>
            </article>
          )}
        </div>
      )}
      {props.mode !== "direct" ? (
        <div className="mt-5">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-ink">
              {props.mode === "youtube" ? "Media file to process" : "Upload your video"}
            </h3>
            <p className="mt-1 text-xs leading-5 text-ink-mute">
              {props.mode === "youtube"
                ? "YouTube provides public details, not the media file required for editing."
                : "The file stays private to your workspace."}
            </p>
          </div>
          <SourceUpload key={props.mode} onUploaded={props.setUploaded} />
        </div>
      ) : null}
      {props.mode === "direct" && (
        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_180px]">
          <label className="grid gap-1.5 text-xs font-medium text-ink">
            Direct HTTPS media URL
            <input
              type="url"
              name="directMediaUrl"
              autoComplete="off"
              spellCheck={false}
              value={props.directUrl}
              onChange={(event) => props.setDirectUrl(event.target.value)}
              placeholder="https://media.example.com/source.mp4…"
              className="h-11 rounded-xl border border-line bg-surface-page px-3 text-sm font-normal outline-none focus:border-ember focus-visible:ring-2 focus-visible:ring-ember/20"
            />
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-ink">
            Expected duration
            <input
              type="number"
              name="directMediaDuration"
              min="1"
              inputMode="numeric"
              value={props.directDuration || ""}
              onChange={(event) => props.setDirectDuration(Number(event.target.value))}
              placeholder="Seconds…"
              className="h-11 rounded-xl border border-line bg-surface-page px-3 text-sm font-normal outline-none focus:border-ember focus-visible:ring-2 focus-visible:ring-ember/20"
            />
          </label>
          <p className="text-xs text-ink-mute sm:col-span-2">
            The worker resolves DNS, rejects private networks, revalidates redirects, streams within
            limits, then runs FFprobe on a local isolated file.
          </p>
        </div>
      )}
      <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface-raised p-4 focus-within:ring-2 focus-within:ring-ember">
        <input
          type="checkbox"
          checked={props.rights}
          onChange={(event) => props.setRights(event.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[var(--ember)]"
        />
        <span>
          <span className="block text-sm font-medium text-ink">
            I own this content or have permission to upload, edit, and export it.
          </span>
          <span className="mt-1 block text-xs leading-5 text-ink-mute">
            This confirmation is stored with the clipping job and policy version.
          </span>
        </span>
      </label>
    </div>
  );
}

function MetadataStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Eye;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-line bg-surface-panel px-2.5 py-2">
      <dt className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-ink-mute">
        <Icon className="h-3 w-3" />
        {label}
      </dt>
      <dd className="mt-1 truncate font-medium tabular-nums text-ink">{value}</dd>
    </div>
  );
}

function formatCount(value: string) {
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(
    Number(value),
  );
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = Math.floor(seconds % 60);
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`
    : `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function formatPublishedDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function Preferences(props: {
  requestedClips: number;
  setRequestedClips: (value: number) => void;
  durationRange: string;
  setDurationRange: (value: string) => void;
  language: string;
  setLanguage: (value: string) => void;
  contentType: string;
  setContentType: (value: string) => void;
  captionPreset: string;
  setCaptionPreset: (value: string) => void;
  instruction: string;
  setInstruction: (value: string) => void;
}) {
  const field =
    "h-11 rounded-xl border border-line bg-surface-page px-3 text-sm text-ink outline-none focus:border-ember";
  return (
    <div>
      <h2 className="font-display text-2xl text-ink">Clip preferences</h2>
      <p className="mt-2 text-sm text-ink-soft">
        These guide selection and remain editable after processing.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-xs font-medium text-ink">
          Source language
          <select
            value={props.language}
            onChange={(event) => props.setLanguage(event.target.value)}
            className={field}
          >
            <option value="auto">Detect automatically</option>
            <option>English</option>
            <option>German</option>
            <option>Spanish</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-ink">
          Content type
          <select
            value={props.contentType}
            onChange={(event) => props.setContentType(event.target.value)}
            className={field}
          >
            {[
              "Podcast",
              "Interview",
              "Educational",
              "Commentary",
              "Tutorial",
              "Vlog",
              "Product demo",
              "Livestream",
              "Other",
            ].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-ink">
          Preferred duration
          <select
            value={props.durationRange}
            onChange={(event) => props.setDurationRange(event.target.value)}
            className={field}
          >
            {["15–30 seconds", "30–60 seconds", "60–90 seconds"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-ink">
          Requested clips
          <input
            type="number"
            min="1"
            max="5"
            value={props.requestedClips}
            onChange={(event) => props.setRequestedClips(Number(event.target.value))}
            className={field}
          />
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-ink">
          Caption preset
          <select
            value={props.captionPreset}
            onChange={(event) => props.setCaptionPreset(event.target.value)}
            className={field}
          >
            <option>Clean editorial</option>
            <option>Bold active word</option>
            <option>Minimal subtitle</option>
          </select>
        </label>
        <div className="rounded-xl border border-line bg-surface-raised px-4 py-3 text-xs text-ink-soft">
          <div className="font-medium text-ink">Target output</div>
          <div className="mt-1">Shorts · Reels · TikTok · 9:16</div>
        </div>
        <label className="grid gap-1.5 text-xs font-medium text-ink sm:col-span-2">
          Additional instruction
          <textarea
            value={props.instruction}
            onChange={(event) => props.setInstruction(event.target.value)}
            rows={4}
            className="rounded-xl border border-line bg-surface-page p-3 text-sm font-normal outline-none focus:border-ember"
          />
        </label>
      </div>
    </div>
  );
}

function Review({
  metadata,
  uploaded,
  sourceMode,
  directUrl,
  sourceSeconds,
  requestedClips,
  durationRange,
  captionPreset,
}: {
  metadata: YouTubeMetadata | null;
  uploaded: UploadedSource | null;
  sourceMode: string;
  directUrl: string;
  sourceSeconds: number;
  requestedClips: number;
  durationRange: string;
  captionPreset: string;
}) {
  const rows = [
    ["Source", metadata?.title ?? uploaded?.filename ?? directUrl],
    ["Source type", sourceMode],
    ["Estimated usage", `${Math.ceil(sourceSeconds / 60)} source minutes`],
    ["Requested results", `${requestedClips} clips · ${durationRange}`],
    ["Captions", captionPreset],
    ["Free export", "720p · one trial without watermark"],
    ["Retention", "7 days on Free"],
    ["Queue", "Standard priority"],
  ];
  return (
    <div>
      <h2 className="font-display text-2xl text-ink">Review the clipping job</h2>
      <p className="mt-2 text-sm text-ink-soft">
        Usage is reserved transactionally. Source validation may correct browser-provided duration
        or format information.
      </p>
      <dl className="mt-5 overflow-hidden rounded-2xl border border-line">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="grid grid-cols-[150px_1fr] border-b border-line px-4 py-3 last:border-0"
          >
            <dt className="text-xs font-medium text-ink-mute">{label}</dt>
            <dd className="text-sm text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
