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
  LoaderCircle,
  MonitorPlay,
  Podcast,
  ShieldCheck,
  Search,
  Youtube,
} from "lucide-react";
import { SourceUpload, type UploadedSource } from "./source-upload";
import { getYouTubeMetadata } from "@/services/youtube/server";
import { parseYouTubeVideoId } from "@/services/youtube/parser";
import { createClipJob } from "@/services/clipping/server";
import { attachSourceToAutomationDraft } from "@/services/youtube/automation.server";
import { resolvePodcastFeed } from "@/services/connectors/rss.server";
import { CONNECTOR_REGISTRY, getConnector } from "@/domain/connectors/registry";
import { detectUrlSource } from "@/domain/connectors/url-resolver";
import type {
  ConnectorDefinition,
  PublicConnectorDefinition,
  RemoteMediaAsset,
} from "@/domain/connectors/types";
import { SourcePicker } from "@/components/connectors/source-picker";
import { ComingSoonConnectorPanel } from "@/components/connectors/coming-soon-connector-panel";
import { AvailabilityBadge } from "@/components/connectors/availability-badge";
import { ConnectorIcon } from "@/components/connectors/connector-icon";
import { ResilientThumbnail } from "@/components/media/resilient-thumbnail";
import { SelectField, type SelectFieldOption } from "@/components/ui/select-field";
import { StatusDialog } from "@/components/ui/status-dialog";
import { WorkerEgressBadge } from "@/components/dashboard/WorkerEgressBadge";
import {
  PLAN_ENTITLEMENTS,
  evaluateJobEntitlement,
  type PlanEntitlement,
  type PlanKey,
} from "@/domain/clipping/entitlements";
import { presentJobError, type JobErrorPresentation } from "./job-error";
import {
  browseConnectorAssets,
  cancelConnectorImport,
  createConnectorImport,
  getConnectorImportProgress,
} from "@/services/connectors/assets.server";

type YouTubeMetadata = Awaited<ReturnType<typeof getYouTubeMetadata>>;
type PodcastFeed = Awaited<ReturnType<typeof resolvePodcastFeed>>;
const steps = ["Video source", "Clip preferences", "Review"];

export function JobWizard({
  initialYoutube = "",
  initialSource = "",
  initialDraft,
  connectors,
  creationContext,
}: {
  initialYoutube?: string;
  initialSource?: string;
  initialDraft?: string;
  connectors?: PublicConnectorDefinition[];
  creationContext?: {
    plan: PlanKey;
    entitlement: PlanEntitlement;
    activeJobs: number;
    reservedSeconds: number;
    committedSeconds: number;
  };
}) {
  const navigate = useNavigate();
  const runtimeConnectors: PublicConnectorDefinition[] =
    connectors ??
    CONNECTOR_REGISTRY.map((connector) => ({
      ...connector,
      connected: false,
      configured: connector.availability === "available",
      executable: connector.availability === "available",
    }));
  const context = creationContext ?? {
    plan: "free" as const,
    entitlement: PLAN_ENTITLEMENTS.free,
    activeJobs: 0,
    reservedSeconds: 0,
    committedSeconds: 0,
  };
  const [step, setStep] = useState(0);
  const initialConnector =
    initialSource === "upload"
      ? "local_upload"
      : initialSource === "direct"
        ? "direct_url"
        : (getConnector(initialSource)?.id ?? "youtube");
  const [sourceMode, setSourceMode] = useState(initialConnector);
  const [youtubeUrl, setYoutubeUrl] = useState(initialYoutube);
  const [directUrl, setDirectUrl] = useState("");
  const [directDuration, setDirectDuration] = useState(0);
  const [rssUrl, setRssUrl] = useState("");
  const [podcastFeed, setPodcastFeed] = useState<PodcastFeed | null>(null);
  const [remoteAsset, setRemoteAsset] = useState<RemoteMediaAsset | null>(null);
  const [connectorImportId, setConnectorImportId] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<{
    status: string;
    bytesTransferred: number;
    bytesTotal: number | null;
  } | null>(null);
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
  const [submitError, setSubmitError] = useState<JobErrorPresentation | null>(null);

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
    const connector = runtimeConnectors.find((item) => item.id === sourceMode);
    if (!connector || !connector.executable) {
      setError(`${connector?.label ?? "This source"} cannot import media in this deployment yet.`);
      return;
    }
    if (step === 0 && ["google_drive", "dropbox", "onedrive"].includes(sourceMode)) {
      if (!remoteAsset) {
        setError(`Choose an authorised file from ${connector.label}.`);
        return;
      }
      if (!uploaded) {
        setBusy(true);
        setError(null);
        try {
          const created = await createConnectorImport({
            data: {
              connectorId: sourceMode as "google_drive" | "dropbox" | "onedrive",
              asset: {
                id: remoteAsset.id,
                name: remoteAsset.name,
                kind: remoteAsset.kind as "video" | "audio",
                mimeType: remoteAsset.mimeType,
                sizeBytes: remoteAsset.sizeBytes,
                durationSeconds: remoteAsset.durationSeconds,
              },
              idempotencyKey: crypto.randomUUID(),
            },
          });
          setConnectorImportId(created.importId);
          for (;;) {
            const progress = await getConnectorImportProgress({
              data: { importId: created.importId },
            });
            setImportProgress(progress);
            if (progress.status === "ready" && progress.assetId) {
              if (!progress.durationSeconds)
                throw new Error("The imported file has no verified duration.");
              setUploaded({
                assetId: progress.assetId,
                filename: progress.filename,
                durationSeconds: progress.durationSeconds,
              });
              break;
            }
            if (["failed", "cancelled"].includes(progress.status))
              throw new Error(progress.errorMessage ?? `The connector import ${progress.status}.`);
            await new Promise((resolve) => window.setTimeout(resolve, 1000));
          }
        } catch (cause) {
          setError(
            cause instanceof Error ? cause.message : "The connector import could not be completed.",
          );
          setBusy(false);
          return;
        }
        setBusy(false);
      }
    }
    if (step === 0 && sourceMode === "youtube" && !metadata && !(await analyseYoutube())) return;
    if (
      step === 0 &&
      ["direct_url", "other", "rss"].includes(sourceMode) &&
      (!directUrl || directDuration <= 0)
    ) {
      setError("Add the authorised HTTPS media URL and its expected duration.");
      return;
    }
    if (step === 0 && sourceMode === "local_upload" && !uploaded) {
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
    setError(null);
    setSubmitError(null);
    try {
      if (!rights) throw new Error("Confirm your rights before creating a processing job.");
      if (sourceMode === "local_upload" && !uploaded)
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
      const entitlementCheck = evaluateJobEntitlement({
        plan: context.plan,
        sourceSeconds: sourceDuration,
        requestedClips,
        activeJobs: context.activeJobs,
        reservedSeconds: context.reservedSeconds,
        committedSeconds: context.committedSeconds,
      });
      if (!entitlementCheck.allowed) {
        setSubmitError(
          presentJobError(new Error(entitlementCheck.reason), context.plan, context.entitlement),
        );
        return;
      }
      setBusy(true);
      const result = await createClipJob({
        data: {
          sourceType: ["direct_url", "other", "rss"].includes(sourceMode)
            ? "direct_owned_media_url"
            : sourceMode === "youtube"
              ? "youtube_metadata"
              : ((["google_drive", "dropbox", "onedrive"].includes(sourceMode)
                  ? sourceMode
                  : "local_upload") as "google_drive" | "dropbox" | "onedrive" | "local_upload"),
          sourceUrl: ["direct_url", "other", "rss"].includes(sourceMode)
            ? directUrl
            : sourceMode === "youtube"
              ? youtubeUrl
              : null,
          sourceIdentifier: metadata?.videoId ?? remoteAsset?.id ?? null,
          sourceDurationSeconds: sourceDuration,
          sourceAssetId: uploaded?.assetId ?? null,
          connectorId: sourceMode,
          connectorImportId,
          sourceMetadata: {
            title:
              metadata?.title ??
              podcastFeed?.episodes.find((episode) => episode.enclosureUrl === directUrl)?.title ??
              uploaded?.filename ??
              "Authorised source",
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
      setSubmitError(presentJobError(cause, context.plan, context.entitlement));
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
      <div
        data-testid="wizard-step-surface"
        className="rounded-3xl border border-line bg-surface-panel p-5 sm:p-7"
      >
        {step === 0 && (
          <ConnectorSourceStep
            connectors={runtimeConnectors}
            mode={sourceMode}
            setMode={(connector) => {
              setSourceMode(connector.id);
              setUploaded(null);
              setMetadata(null);
              setPodcastFeed(null);
              setDirectUrl("");
              setDirectDuration(0);
              setRemoteAsset(null);
              setConnectorImportId(null);
              setImportProgress(null);
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
            rssUrl={rssUrl}
            setRssUrl={setRssUrl}
            podcastFeed={podcastFeed}
            setPodcastFeed={setPodcastFeed}
            remoteAsset={remoteAsset}
            setRemoteAsset={setRemoteAsset}
            connectorImportId={connectorImportId}
            importProgress={importProgress}
            cancelImport={async () => {
              if (!connectorImportId) return;
              await cancelConnectorImport({ data: { importId: connectorImportId } });
            }}
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
            plan={context.plan}
            entitlement={context.entitlement}
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
            plan={context.plan}
            entitlement={context.entitlement}
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
        <div className="sticky -bottom-5 z-10 mt-7 flex justify-between border-t border-line bg-surface-panel/95 pt-5 pb-1 backdrop-blur sm:static sm:bg-transparent sm:pb-0 sm:backdrop-blur-none">
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
      <StatusDialog
        open={Boolean(submitError)}
        onOpenChange={(open) => {
          if (!open) setSubmitError(null);
        }}
        variant={submitError?.variant ?? "error"}
        title={submitError?.title ?? "The clipping job could not be created"}
        description={submitError?.description ?? "Check the source and try again."}
        primaryAction={
          submitError?.kind === "clip-limit"
            ? {
                label: `Use ${context.entitlement.maxClipsPerJob} clips`,
                onClick: () => setRequestedClips(context.entitlement.maxClipsPerJob),
              }
            : submitError?.upgrade
              ? { label: "View upgrade options", href: "/app/billing" }
              : { label: "Try again" }
        }
        secondaryAction={
          submitError?.kind === "clip-limit" && submitError.upgrade
            ? { label: "View upgrade options", href: "/app/billing" }
            : undefined
        }
      />
    </div>
  );
}

function ConnectorSourceStep(props: {
  connectors: PublicConnectorDefinition[];
  mode: string;
  setMode: (connector: ConnectorDefinition) => void;
  youtubeUrl: string;
  setYoutubeUrl: (value: string) => void;
  busy: boolean;
  metadata: YouTubeMetadata | null;
  directUrl: string;
  setDirectUrl: (value: string) => void;
  directDuration: number;
  setDirectDuration: (value: number) => void;
  rssUrl: string;
  setRssUrl: (value: string) => void;
  podcastFeed: PodcastFeed | null;
  setPodcastFeed: (value: PodcastFeed | null) => void;
  remoteAsset: RemoteMediaAsset | null;
  setRemoteAsset: (value: RemoteMediaAsset | null) => void;
  connectorImportId: string | null;
  importProgress: { status: string; bytesTransferred: number; bytesTotal: number | null } | null;
  cancelImport: () => Promise<void>;
  setUploaded: (value: UploadedSource) => void;
  rights: boolean;
  setRights: (value: boolean) => void;
}) {
  const connector =
    props.connectors.find((item) => item.id === props.mode) ??
    props.connectors.find((item) => item.id === "youtube")!;
  const [rssBusy, setRssBusy] = useState(false);
  const [rssError, setRssError] = useState<string | null>(null);

  const routeSourceUrl = (value: string) => {
    const detected = detectUrlSource(value);
    if (!detected.valid || ["direct_url", "other"].includes(detected.connectorId)) {
      props.setDirectUrl(value);
      return;
    }
    const detectedConnector = props.connectors.find((item) => item.id === detected.connectorId);
    if (!detectedConnector) {
      props.setDirectUrl(value);
      return;
    }
    props.setMode(detectedConnector);
    if (detected.connectorId === "youtube") props.setYoutubeUrl(value);
    if (detected.connectorId === "rss") props.setRssUrl(value);
  };

  const loadFeed = async () => {
    setRssBusy(true);
    setRssError(null);
    try {
      const feed = await resolvePodcastFeed({ data: { url: props.rssUrl } });
      props.setPodcastFeed(feed);
    } catch (cause) {
      setRssError(
        cause instanceof Error ? cause.message : "The podcast feed could not be resolved.",
      );
    } finally {
      setRssBusy(false);
    }
  };

  return (
    <div>
      <h2 className="font-display text-2xl text-ink">Choose the video source</h2>
      <p className="mt-2 text-sm text-ink-soft">
        Pick an authorised source. Availability and original-file requirements are shown before you
        connect or import.
      </p>
      <div className="mt-5">
        <SourcePicker
          connectors={props.connectors}
          connectedIds={props.connectors.filter((item) => item.connected).map((item) => item.id)}
          value={connector.id}
          onChange={props.setMode}
        />
      </div>

      {!connector.executable ? (
        <ComingSoonConnectorPanel connector={connector} />
      ) : (
        <section
          data-testid={connector.id === "youtube" ? "youtube-source-fields" : undefined}
          className="mt-6"
        >
          {connector.id !== "youtube" ? (
            <header className="flex items-start gap-3 border-b border-line pb-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-sunken text-ink-soft">
                <ConnectorIcon connectorId={connector.id} icon={connector.icon} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-ink">{connector.label}</h3>
                  <AvailabilityBadge availability={connector.availability} />
                  {connector.requiresOriginalSource ? (
                    <span className="rounded-full border border-line px-2 py-0.5 text-[10px] font-semibold text-ink-mute">
                      Original file required
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs leading-5 text-ink-mute">{connector.description}</p>
              </div>
            </header>
          ) : null}

          {connector.id === "youtube" ? (
            <div>
              <div className="mb-4">
                <WorkerEgressBadge />
              </div>
              <label
                className="grid gap-1.5 text-xs font-medium text-ink"
                htmlFor="youtube-source-url"
              >
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
              <div className="mt-2 flex min-h-5 flex-wrap items-center justify-between gap-2 text-xs text-ink-mute">
                {props.busy ? <span role="status">Loading video details…</span> : null}
              </div>
              {props.metadata ? (
                <article className="mt-4 flex min-w-0 gap-3 rounded-2xl border border-line bg-surface-panel p-3 sm:items-center">
                  <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-xl bg-surface-sunken sm:w-44">
                    <ResilientThumbnail
                      src={props.metadata.thumbnailUrl}
                      fallbackSrc={`https://i.ytimg.com/vi/${props.metadata.videoId}/hqdefault.jpg`}
                      alt={`Thumbnail for ${props.metadata.title}`}
                      className="h-full w-full"
                    />
                    <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white">
                      {formatDuration(props.metadata.durationSeconds)}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="line-clamp-2 text-sm font-semibold leading-5 text-ink">
                      {props.metadata.title}
                    </h4>
                    <p className="mt-1 truncate text-xs text-ink-mute">
                      {props.metadata.channelTitle}
                    </p>
                  </div>
                </article>
              ) : null}
            </div>
          ) : null}

          {connector.id === "local_upload" ? (
            <div className="mt-4">
              <SourceUpload key="local_upload" onUploaded={props.setUploaded} />
              <p className="mt-2 text-xs text-ink-mute">
                The current processing pipeline accepts MP4, MOV, MKV, WebM, and M4V source video.
                Audio-only and transcript attachments remain catalogued but are not presented as
                executable until their render path is verified.
              </p>
            </div>
          ) : null}

          {["direct_url", "other"].includes(connector.id) ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px]">
              <label className="grid gap-1.5 text-xs font-medium text-ink">
                Owner-controlled HTTPS media URL
                <input
                  type="url"
                  name="directMediaUrl"
                  autoComplete="off"
                  spellCheck={false}
                  value={props.directUrl}
                  onChange={(event) => routeSourceUrl(event.target.value)}
                  placeholder="https://media.example.com/source.mp4"
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
                  placeholder="Seconds"
                  className="h-11 rounded-xl border border-line bg-surface-page px-3 text-sm font-normal outline-none focus:border-ember focus-visible:ring-2 focus-visible:ring-ember/20"
                />
              </label>
              <p className="flex items-start gap-2 text-xs leading-5 text-ink-mute sm:col-span-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                The worker resolves DNS, rejects private networks, revalidates every redirect,
                bounds size and time, and only passes an isolated local file to FFprobe.
              </p>
            </div>
          ) : null}

          {connector.id === "rss" ? (
            <div className="mt-4">
              <label className="grid gap-1.5 text-xs font-medium text-ink">
                Podcast episode, RSS, Atom, or Apple Podcasts URL
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={props.rssUrl}
                    onChange={(event) => {
                      props.setRssUrl(event.target.value);
                      props.setPodcastFeed(null);
                    }}
                    placeholder="https://example.com/feed.xml"
                    className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface-page px-3 text-sm font-normal outline-none focus:border-ember"
                  />
                  <button
                    type="button"
                    onClick={() => void loadFeed()}
                    disabled={rssBusy || !props.rssUrl}
                    className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-semibold text-surface-page disabled:opacity-50"
                  >
                    {rssBusy ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Podcast className="h-4 w-4" />
                    )}{" "}
                    Load feed
                  </button>
                </div>
              </label>
              {rssError ? (
                <p role="alert" className="mt-2 text-xs text-danger">
                  {rssError}
                </p>
              ) : null}
              {props.podcastFeed ? (
                <div className="mt-4">
                  <div className="flex items-center gap-3 rounded-xl bg-surface-sunken p-3">
                    {props.podcastFeed.artworkUrl ? (
                      <img
                        src={props.podcastFeed.artworkUrl}
                        alt=""
                        className="h-12 w-12 rounded-lg object-cover"
                      />
                    ) : (
                      <span className="grid h-12 w-12 place-items-center rounded-lg bg-surface-panel">
                        <Podcast className="h-5 w-5" />
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">
                        {props.podcastFeed.title}
                      </p>
                      <p className="text-xs text-ink-mute">
                        {props.podcastFeed.episodes.length} recent public enclosures
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
                    {props.podcastFeed.episodes.map((episode) => (
                      <button
                        key={episode.id}
                        type="button"
                        onClick={() => {
                          props.setDirectUrl(episode.enclosureUrl);
                          props.setDirectDuration(episode.durationSeconds ?? 0);
                        }}
                        className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left ${props.directUrl === episode.enclosureUrl ? "border-ember bg-ember-soft/30" : "border-line bg-surface-page"}`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 text-sm font-medium text-ink">
                            {episode.title}
                          </span>
                          <span className="mt-1 block text-xs text-ink-mute">
                            {episode.publishedAt
                              ? formatPublishedDate(episode.publishedAt)
                              : "Date unavailable"}
                            {episode.durationSeconds
                              ? ` · ${formatDuration(episode.durationSeconds)}`
                              : " · duration required"}
                          </span>
                        </span>
                        {props.directUrl === episode.enclosureUrl ? (
                          <Check className="h-4 w-4 shrink-0 text-ember-ink" />
                        ) : null}
                      </button>
                    ))}
                  </div>
                  {props.directUrl && props.directDuration <= 0 ? (
                    <label className="mt-3 grid gap-1.5 text-xs font-medium text-ink">
                      Expected episode duration
                      <input
                        type="number"
                        min="1"
                        inputMode="numeric"
                        value={props.directDuration || ""}
                        onChange={(event) => props.setDirectDuration(Number(event.target.value))}
                        className="h-10 rounded-xl border border-line bg-surface-page px-3 text-sm font-normal"
                      />
                    </label>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {["google_drive", "dropbox", "onedrive"].includes(connector.id) ? (
            <CloudAssetBrowser
              connector={connector}
              selected={props.remoteAsset}
              onSelect={props.setRemoteAsset}
              importProgress={props.importProgress}
              importing={Boolean(props.connectorImportId)}
              onCancel={props.cancelImport}
            />
          ) : null}
        </section>
      )}

      {connector.executable ? (
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
      ) : null}
    </div>
  );
}

export function CloudAssetBrowser({
  connector,
  selected,
  onSelect,
  importProgress,
  importing,
  onCancel,
}: {
  connector: PublicConnectorDefinition;
  selected: RemoteMediaAsset | null;
  onSelect: (asset: RemoteMediaAsset | null) => void;
  importProgress: { status: string; bytesTransferred: number; bytesTotal: number | null } | null;
  importing: boolean;
  onCancel: () => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [sharedWithMe, setSharedWithMe] = useState(false);
  const [assets, setAssets] = useState<RemoteMediaAsset[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (nextCursor?: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await browseConnectorAssets({
        data: {
          connectorId: connector.id as "google_drive" | "dropbox" | "onedrive",
          query: query || undefined,
          cursor: nextCursor,
          sharedWithMe: connector.id === "google_drive" ? sharedWithMe : undefined,
        },
      });
      setAssets((current) => (nextCursor ? [...current, ...result.assets] : result.assets));
      setCursor(result.nextCursor);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : `${connector.label} files could not be loaded.`,
      );
    } finally {
      setLoading(false);
    }
  };

  if (!connector.connected) {
    return (
      <div className="mt-4 rounded-xl border border-line bg-surface-panel p-4">
        <h4 className="text-sm font-semibold text-ink">Connect {connector.label}</h4>
        <p className="mt-1 text-xs leading-5 text-ink-mute">
          Authorize read-only file access in Settings. Provider tokens stay encrypted on the server.
        </p>
        <a
          href="/app/settings/integrations"
          className="mt-3 inline-flex rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-surface-page"
        >
          Open connection settings
        </a>
      </div>
    );
  }

  const percent = importProgress?.bytesTotal
    ? Math.min(100, Math.round((importProgress.bytesTransferred / importProgress.bytesTotal) * 100))
    : null;
  return (
    <div className="mt-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-surface-page px-3">
          <Search className="h-4 w-4 text-ink-mute" />
          <span className="sr-only">Search {connector.label}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void load();
              }
            }}
            placeholder={`Search ${connector.label}`}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </label>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading || importing}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ink px-4 text-sm font-semibold text-surface-page disabled:opacity-50"
        >
          {loading ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}{" "}
          Browse files
        </button>
      </div>
      {connector.id === "google_drive" ? (
        <label className="mt-3 inline-flex items-center gap-2 text-xs text-ink-soft">
          <input
            type="checkbox"
            checked={sharedWithMe}
            onChange={(event) => setSharedWithMe(event.target.checked)}
            className="accent-[var(--ember)]"
          />
          Shared with me
        </label>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-xs text-danger">
          {error}
        </p>
      ) : null}
      {assets.length ? (
        <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">
          {assets.map((asset) => (
            <button
              key={asset.id}
              type="button"
              disabled={importing}
              onClick={() => onSelect(asset)}
              className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left disabled:opacity-60 ${selected?.id === asset.id ? "border-ember bg-ember-soft/30" : "border-line bg-surface-page"}`}
            >
              {asset.thumbnailUrl ? (
                <img
                  src={asset.thumbnailUrl}
                  alt=""
                  className="h-12 w-16 rounded-lg object-cover"
                />
              ) : (
                <span className="grid h-12 w-16 place-items-center rounded-lg bg-surface-sunken">
                  <FileVideo className="h-5 w-5 text-ink-mute" />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{asset.name}</span>
                <span className="mt-1 block text-xs text-ink-mute">
                  {asset.kind === "audio" ? "Audio" : "Video"}
                  {asset.durationSeconds ? ` · ${formatDuration(asset.durationSeconds)}` : ""}
                  {asset.sizeBytes ? ` · ${formatBytes(asset.sizeBytes)}` : ""}
                </span>
              </span>
              {selected?.id === asset.id ? (
                <Check className="h-4 w-4 shrink-0 text-ember-ink" />
              ) : null}
            </button>
          ))}
          {cursor ? (
            <button
              type="button"
              onClick={() => void load(cursor)}
              disabled={loading}
              className="w-full rounded-xl border border-line py-2.5 text-xs font-semibold text-ink-soft"
            >
              Load more
            </button>
          ) : null}
        </div>
      ) : null}
      {importProgress ? (
        <div className="mt-4 rounded-xl border border-line bg-surface-panel p-4">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="font-semibold capitalize text-ink">
              {importProgress.status.replaceAll("_", " ")}
            </span>
            <span className="text-ink-mute">
              {percent === null ? formatBytes(importProgress.bytesTransferred) : `${percent}%`}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
            <div
              className="h-full rounded-full bg-ember transition-[width]"
              style={{ width: `${percent ?? 20}%` }}
            />
          </div>
          {!["ready", "failed", "cancelled"].includes(importProgress.status) ? (
            <button
              type="button"
              onClick={() => void onCancel()}
              className="mt-3 text-xs font-semibold text-danger"
            >
              Cancel import
            </button>
          ) : null}
        </div>
      ) : null}
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
      <div className="mt-4">
        <WorkerEgressBadge />
      </div>
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

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
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
  plan: PlanKey;
  entitlement: PlanEntitlement;
}) {
  const simpleOptions = (values: readonly string[]): SelectFieldOption[] =>
    values.map((value) => ({ value, label: value }));
  return (
    <div>
      <h2 className="font-display text-2xl text-ink">Clip preferences</h2>
      <p className="mt-2 text-sm text-ink-soft">
        These guide selection and remain editable after processing.
      </p>
      <div
        data-testid="preferences-grid"
        className="mt-5 grid items-stretch gap-4 sm:grid-cols-2 sm:[grid-auto-rows:minmax(5.75rem,auto)] sm:[&>*]:h-full"
      >
        <SelectField
          label="Source language"
          value={props.language}
          onValueChange={props.setLanguage}
          options={[
            { value: "auto", label: "Detect automatically" },
            ...simpleOptions(["English", "German", "Spanish"]),
          ]}
        />
        <SelectField
          label="Content type"
          value={props.contentType}
          onValueChange={props.setContentType}
          options={simpleOptions([
            "Podcast",
            "Interview",
            "Educational",
            "Commentary",
            "Tutorial",
            "Vlog",
            "Product demo",
            "Livestream",
            "Other",
          ])}
        />
        <SelectField
          label="Preferred duration"
          value={props.durationRange}
          onValueChange={props.setDurationRange}
          options={simpleOptions(["15–30 seconds", "30–60 seconds", "60–90 seconds"])}
        />
        <SelectField
          label="Requested clips"
          value={String(props.requestedClips)}
          onValueChange={(value) => props.setRequestedClips(Number(value))}
          options={clipCountOptions(props.entitlement)}
          hint={`${planName(props.plan)} includes up to ${props.entitlement.maxClipsPerJob} clips per job. Locked options show what higher tiers unlock.`}
        />
        <SelectField
          label="Caption preset"
          value={props.captionPreset}
          onValueChange={props.setCaptionPreset}
          options={simpleOptions(["Clean editorial", "Bold active word", "Minimal subtitle"])}
        />
        <div className="grid min-w-0 gap-1.5">
          <div className="text-xs font-medium text-ink">Target output</div>
          <div className="flex h-11 items-center rounded-xl border border-line bg-surface-raised px-3 text-sm text-ink-soft">
            Shorts · Reels · TikTok · 9:16
          </div>
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

function clipCountOptions(entitlement: PlanEntitlement): SelectFieldOption[] {
  return [1, 2, 3, 4, 5, 10, 20, 50].map((count) => ({
    value: String(count),
    label: `${count} ${count === 1 ? "clip" : "clips"}`,
    badge: count > 20 ? "Pro" : count > 5 ? "Creator" : undefined,
    description:
      count > entitlement.maxClipsPerJob
        ? `Available on ${count > 20 ? "Pro" : "Creator"}`
        : undefined,
    disabled: count > entitlement.maxClipsPerJob,
  }));
}

function planName(plan: PlanKey) {
  return plan.charAt(0).toUpperCase() + plan.slice(1);
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
  plan,
  entitlement,
}: {
  metadata: YouTubeMetadata | null;
  uploaded: UploadedSource | null;
  sourceMode: string;
  directUrl: string;
  sourceSeconds: number;
  requestedClips: number;
  durationRange: string;
  captionPreset: string;
  plan: PlanKey;
  entitlement: PlanEntitlement;
}) {
  const rows = [
    ["Source", metadata?.title ?? uploaded?.filename ?? directUrl],
    ["Source type", sourceMode],
    ["Estimated usage", `${Math.ceil(sourceSeconds / 60)} source minutes`],
    ["Requested results", `${requestedClips} clips · ${durationRange}`],
    ["Captions", captionPreset],
    [
      "Export",
      `${entitlement.maxExport.height}p${entitlement.watermarkRequired ? " · watermark after the first trial export" : " · no watermark"}`,
    ],
    ["Retention", `${entitlement.retentionDays} days on ${planName(plan)}`],
    ["Queue", entitlement.priority > 10 ? "Priority processing" : "Standard priority"],
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
            className="grid min-h-14 gap-1 border-b border-line px-4 py-3 last:border-0 sm:grid-cols-[minmax(9rem,0.35fr)_1fr] sm:items-center sm:gap-4"
          >
            <dt className="text-xs font-medium text-ink-mute">{label}</dt>
            <dd className="text-sm text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
