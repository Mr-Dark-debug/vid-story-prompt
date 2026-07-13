import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  FileVideo,
  Link2,
  ShieldCheck,
  Youtube,
} from "lucide-react";
import { SourceUpload, type UploadedSource } from "./source-upload";
import { TurnstileWidget } from "@/components/security/turnstile";
import { getPublicEnv } from "@/config/env";
import { getYouTubeMetadata } from "@/services/youtube/server";
import { createClipJob } from "@/services/clipping/server";
import { beginYouTubeConnection } from "@/services/youtube/oauth.server";
import { attachSourceToAutomationDraft } from "@/services/youtube/automation.server";

type YouTubeMetadata = Awaited<ReturnType<typeof getYouTubeMetadata>>;
const steps = ["Video source", "Rights & source", "Clip preferences", "Review"];

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
  const turnstileSiteKey = getPublicEnv().VITE_TURNSTILE_SITE_KEY;
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
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);

  useEffect(() => {
    if (!initialYoutube || turnstileSiteKey) return;
    let active = true;
    setBusy(true);
    setError(null);
    getYouTubeMetadata({ data: { url: initialYoutube } })
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
    return () => {
      active = false;
    };
  }, [initialYoutube, turnstileSiteKey]);
  const analyseYoutube = async () => {
    if (turnstileSiteKey && !turnstileToken) {
      setError("Complete the abuse-protection check before retrieving YouTube details.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setMetadata(
        await getYouTubeMetadata({
          data: { turnstileToken: turnstileToken ?? undefined, url: youtubeUrl },
        }),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "YouTube details are unavailable.");
    } finally {
      setBusy(false);
      if (turnstileSiteKey) {
        setTurnstileToken(null);
        setTurnstileResetKey((value) => value + 1);
      }
    }
  };
  const next = () => {
    if (step === 0 && sourceMode === "youtube" && !metadata) {
      setError("Retrieve the YouTube details before continuing.");
      return;
    }
    if (step === 0 && sourceMode === "direct" && (!directUrl || directDuration <= 0)) {
      setError("Add the authorised HTTPS media URL and its expected duration.");
      return;
    }
    if (step === 1 && !rights) {
      setError("Confirm your rights before creating a processing job.");
      return;
    }
    if (step === 1 && sourceMode !== "direct" && !uploaded) {
      setError("Upload the authorised original media file before continuing.");
      return;
    }
    setError(null);
    setStep((value) => Math.min(3, value + 1));
  };
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
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
      <ol className="mb-8 grid grid-cols-4 gap-2">
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
            setMode={setSourceMode}
            youtubeUrl={youtubeUrl}
            setYoutubeUrl={setYoutubeUrl}
            analyse={analyseYoutube}
            busy={busy}
            metadata={metadata}
            directUrl={directUrl}
            setDirectUrl={setDirectUrl}
            directDuration={directDuration}
            setDirectDuration={setDirectDuration}
            setTurnstileToken={setTurnstileToken}
            turnstileReady={!turnstileSiteKey || Boolean(turnstileToken)}
            turnstileResetKey={turnstileResetKey}
            turnstileSiteKey={turnstileSiteKey}
          />
        )}
        {step === 1 && (
          <div>
            <h2 className="font-display text-2xl text-ink">Rights and source file</h2>
            <p className="mt-2 text-sm text-ink-soft">
              A connected YouTube account can verify management, but the official API does not
              provide the original media file.
            </p>
            {sourceMode !== "direct" && (
              <div className="mt-5">
                <SourceUpload onUploaded={setUploaded} />
              </div>
            )}
            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface-raised p-4">
              <input
                type="checkbox"
                checked={rights}
                onChange={(event) => setRights(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[var(--ember)]"
              />
              <span>
                <span className="block text-sm font-medium text-ink">
                  I own this content or have permission to upload, edit and export it.
                </span>
                <span className="mt-1 block text-xs text-ink-mute">
                  Acceptance is stored with the job, statement version and policy version.
                </span>
              </span>
            </label>
          </div>
        )}
        {step === 2 && (
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
        {step === 3 && (
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
          {step < 3 ? (
            <button
              type="button"
              onClick={next}
              className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-surface-page"
            >
              Continue
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={submit}
              className="inline-flex items-center gap-2 rounded-lg bg-ember px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
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
  analyse: () => void;
  busy: boolean;
  metadata: YouTubeMetadata | null;
  directUrl: string;
  setDirectUrl: (value: string) => void;
  directDuration: number;
  setDirectDuration: (value: number) => void;
  setTurnstileToken: (token: string | null) => void;
  turnstileReady: boolean;
  turnstileResetKey: number;
  turnstileSiteKey?: string;
}) {
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const modes = [
    {
      key: "youtube" as const,
      icon: Youtube,
      title: "YouTube URL",
      body: "Official details and ownership state",
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
        Google Drive is planned. YouTube connection verifies management when OAuth credentials are
        configured.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {modes.map((mode) => (
          <button
            key={mode.key}
            type="button"
            onClick={() => props.setMode(mode.key)}
            className={`rounded-2xl border p-4 text-left ${props.mode === mode.key ? "border-ember bg-ember-soft/40" : "border-line bg-surface-raised"}`}
          >
            <mode.icon className="h-5 w-5 text-ember" />
            <div className="mt-4 text-sm font-semibold text-ink">{mode.title}</div>
            <div className="mt-1 text-xs text-ink-mute">{mode.body}</div>
          </button>
        ))}
      </div>
      {props.mode === "youtube" && (
        <div className="mt-5">
          <div className="flex gap-2">
            <input
              value={props.youtubeUrl}
              onChange={(event) => props.setYoutubeUrl(event.target.value)}
              placeholder="https://youtube.com/watch?v=…"
              className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface-page px-3 text-sm outline-none focus:border-ember"
            />
            <button
              type="button"
              disabled={props.busy || !props.turnstileReady}
              onClick={props.analyse}
              className="rounded-xl bg-ink px-4 text-sm font-semibold text-surface-page"
            >
              Retrieve details
            </button>
          </div>
          {props.turnstileSiteKey && (
            <TurnstileWidget
              onToken={props.setTurnstileToken}
              resetKey={props.turnstileResetKey}
              siteKey={props.turnstileSiteKey}
            />
          )}
          {props.metadata && (
            <div className="mt-4 flex gap-4 rounded-xl border border-line p-3">
              <img
                src={props.metadata.thumbnailUrl}
                alt=""
                className="w-32 rounded-lg object-cover"
              />
              <div>
                <div className="text-sm font-semibold text-ink">{props.metadata.title}</div>
                <div className="mt-1 text-xs text-ink-mute">
                  {props.metadata.channelTitle} · {Math.ceil(props.metadata.durationSeconds / 60)}{" "}
                  min
                </div>
                <div className="mt-2 inline-flex items-center gap-1 text-xs text-warning">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Ownership unknown · source file required
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    setConnectionError(null);
                    try {
                      const connection = await beginYouTubeConnection({
                        data: {
                          capability: "channel_read",
                          returnTo: "/app/youtube-clipper/new",
                        },
                      });
                      window.location.assign(connection.url);
                    } catch (cause) {
                      setConnectionError(
                        cause instanceof Error
                          ? cause.message
                          : "YouTube connection is unavailable.",
                      );
                    }
                  }}
                  className="mt-3 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink"
                >
                  Connect YouTube for automation
                </button>
                <p className="mt-2 max-w-md text-[11px] leading-relaxed text-ink-mute">
                  Optional. You do not need to connect YouTube to clip an authorised upload or
                  owner-controlled media URL.
                </p>
                {connectionError && <p className="mt-2 text-xs text-danger">{connectionError}</p>}
              </div>
            </div>
          )}
        </div>
      )}
      {props.mode === "upload" && (
        <p className="mt-5 rounded-xl bg-info/5 px-4 py-3 text-sm text-ink-soft">
          You’ll choose and upload the original file in the next step.
        </p>
      )}
      {props.mode === "direct" && (
        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_180px]">
          <input
            type="url"
            value={props.directUrl}
            onChange={(event) => props.setDirectUrl(event.target.value)}
            placeholder="https://media.example.com/source.mp4"
            className="h-11 rounded-xl border border-line bg-surface-page px-3 text-sm outline-none focus:border-ember"
          />
          <input
            type="number"
            min="1"
            value={props.directDuration || ""}
            onChange={(event) => props.setDirectDuration(Number(event.target.value))}
            placeholder="Expected seconds"
            className="h-11 rounded-xl border border-line bg-surface-page px-3 text-sm outline-none focus:border-ember"
          />
          <p className="text-xs text-ink-mute sm:col-span-2">
            The worker resolves DNS, rejects private networks, revalidates redirects, streams within
            limits, then runs FFprobe on a local isolated file.
          </p>
        </div>
      )}
    </div>
  );
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
