import { useEffect, useMemo, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { Check, ExternalLink, LoaderCircle, Send, ShieldCheck } from "lucide-react";
import { ConnectorIcon } from "@/components/connectors/connector-icon";
import { SelectField } from "@/components/ui/select-field";
import {
  createSocialPublishingJob,
  getTikTokCreatorPostingOptions,
  type SocialPublishingPlatform,
} from "@/services/connectors/publishing.server";

type Destination = {
  connectionId: string;
  platform: SocialPublishingPlatform;
  displayName: string;
  targets: { id: string; label: string; pageId?: string }[];
  constraints: { privateOnly: boolean };
};
type ExportItem = { id: string; status: string; export_type: string };
type PublishingJob = {
  id: string;
  title: string;
  platform: string;
  status: string;
  provider_video_url: string | null;
  last_error_message: string | null;
};

const platformLabels: Record<SocialPublishingPlatform, string> = {
  facebook: "Facebook Pages",
  instagram: "Instagram Professional",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
};

export function SocialPublishPanel({
  exports,
  destinations,
  jobs,
  configuredPlatforms,
  defaultTitle,
}: {
  exports: ExportItem[];
  destinations: Destination[];
  jobs: PublishingJob[];
  configuredPlatforms: string[];
  defaultTitle: string;
}) {
  const router = useRouter();
  const completed = exports.filter((item) => item.status === "complete");
  const choices = useMemo(
    () =>
      destinations.flatMap((destination) =>
        destination.targets.map((target) => ({
          value: `${destination.connectionId}::${target.id}`,
          label: `${platformLabels[destination.platform]} · ${target.label}`,
          destination,
          target,
        })),
      ),
    [destinations],
  );
  const [choiceValue, setChoiceValue] = useState(choices[0]?.value ?? "");
  const choice = choices.find((item) => item.value === choiceValue) ?? choices[0];
  const [exportId, setExportId] = useState(completed[0]?.id ?? "");
  const [title, setTitle] = useState(defaultTitle.slice(0, 2200));
  const [caption, setCaption] = useState("");
  const [privacyLevel, setPrivacyLevel] = useState("SELF_ONLY");
  const [privacyOptions, setPrivacyOptions] = useState<string[]>(["SELF_ONLY"]);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [shareToFeed, setShareToFeed] = useState(true);
  const [busy, setBusy] = useState(false);
  const [optionsBusy, setOptionsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (choice?.destination.platform !== "tiktok") {
      setPrivacyOptions(["SELF_ONLY"]);
      setPrivacyLevel("SELF_ONLY");
      return;
    }
    let active = true;
    setOptionsBusy(true);
    getTikTokCreatorPostingOptions({ data: { connectionId: choice.destination.connectionId } })
      .then((options) => {
        if (!active) return;
        const levels = options.privacyLevels.length ? options.privacyLevels : ["SELF_ONLY" as const];
        setPrivacyOptions(levels);
        setPrivacyLevel(levels[0]);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "TikTok creator options could not be refreshed.",
          );
      })
      .finally(() => {
        if (active) setOptionsBusy(false);
      });
    return () => {
      active = false;
    };
  }, [choice?.destination.connectionId, choice?.destination.platform]);

  if (!completed.length) return null;

  const publish = async () => {
    if (!choice || !reviewConfirmed) return;
    setBusy(true);
    setError(null);
    try {
      await createSocialPublishingJob({
        data: {
          exportId,
          platform: choice.destination.platform,
          connectionId: choice.destination.connectionId,
          targetAccountId: choice.target.id,
          title,
          caption,
          idempotencyKey: crypto.randomUUID(),
          reviewConfirmed: true,
          options: {
            privacyLevel:
              choice.destination.platform === "tiktok"
                ? (privacyLevel as
                    | "PUBLIC_TO_EVERYONE"
                    | "MUTUAL_FOLLOW_FRIENDS"
                    | "FOLLOWER_OF_CREATOR"
                    | "SELF_ONLY")
                : undefined,
            shareToFeed:
              choice.destination.platform === "instagram" ? shareToFeed : undefined,
          },
        },
      });
      setReviewConfirmed(false);
      await router.invalidate();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The publishing job could not be created.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-8 overflow-hidden rounded-3xl border border-line bg-surface-panel">
      <header className="border-b border-line bg-surface-raised px-5 py-5">
        <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-ember-ink">
          Credential-gated beta
        </p>
        <h2 className="mt-1 font-display text-xl text-ink">Publish to social channels</h2>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-ink-mute">
          Publishing uses a separate authorised connection. Every post is reviewed here before it
          enters the provider queue; clipping permission never grants publishing permission.
        </p>
      </header>

      {!choices.length ? (
        <div className="p-5">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {(Object.keys(platformLabels) as SocialPublishingPlatform[]).map((platform) => (
              <div key={platform} className="flex items-center gap-3 rounded-xl border border-line bg-surface-raised p-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-surface-sunken text-ink-soft">
                  <ConnectorIcon connectorId={platform} icon="video" />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-ink">{platformLabels[platform]}</div>
                  <div className="text-xs text-ink-mute">
                    {configuredPlatforms.includes(platform) ? "Ready to connect" : "Credentials required"}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm leading-6 text-ink-soft">
            Connect an approved provider app and destination before publishing. No post is simulated
            while credentials, scopes, or app review are missing.
          </p>
          <Link to="/app/settings/integrations" className="mt-3 inline-flex font-semibold text-ember-ink">
            Open publishing integrations
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 p-5 lg:grid-cols-[1fr_.8fr]">
          <div className="grid content-start gap-4">
            <SelectField
              label="Destination"
              value={choiceValue}
              onValueChange={setChoiceValue}
              options={choices.map(({ value, label }) => ({ value, label }))}
            />
            <SelectField
              label="Video export"
              value={exportId}
              onValueChange={setExportId}
              options={completed.map((item) => ({
                value: item.id,
                label: item.export_type.replaceAll("_", " "),
              }))}
            />
            <label className="grid gap-1.5 text-xs font-medium text-ink">
              Post title
              <input
                value={title}
                maxLength={2200}
                onChange={(event) => setTitle(event.target.value)}
                className="h-11 rounded-xl border border-line bg-surface-page px-3 text-sm font-normal"
              />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-ink">
              Caption or commentary
              <textarea
                value={caption}
                maxLength={5000}
                rows={4}
                onChange={(event) => setCaption(event.target.value)}
                className="rounded-xl border border-line bg-surface-page p-3 text-sm font-normal"
              />
            </label>
          </div>
          <div className="grid content-start gap-4">
            {choice?.destination.platform === "tiktok" ? (
              <SelectField
                label={optionsBusy ? "Refreshing TikTok privacy…" : "TikTok privacy"}
                value={privacyLevel}
                onValueChange={setPrivacyLevel}
                options={privacyOptions.map((value) => ({
                  value,
                  label: value.toLowerCase().replaceAll("_", " "),
                }))}
              />
            ) : null}
            {choice?.destination.platform === "instagram" ? (
              <label className="flex items-center gap-3 rounded-xl border border-line bg-surface-raised px-4 py-3 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={shareToFeed}
                  onChange={(event) => setShareToFeed(event.target.checked)}
                  className="h-4 w-4 accent-[var(--ember)]"
                />
                Also share this Reel to the feed
              </label>
            ) : null}
            <div className="rounded-xl border border-line bg-surface-raised p-4 text-xs leading-5 text-ink-soft">
              <div className="flex items-center gap-2 font-semibold text-ink">
                <ShieldCheck className="h-4 w-4 text-success" /> Provider review boundary
              </div>
              <p className="mt-2">
                TikTok unaudited apps are restricted to private posts. Meta requires a Page or
                professional Instagram account. LinkedIn publishing requires approved member-social
                access.
              </p>
            </div>
            <label className="flex items-start gap-3 rounded-xl border border-line bg-surface-page p-4 text-sm leading-6 text-ink">
              <input
                type="checkbox"
                checked={reviewConfirmed}
                onChange={(event) => setReviewConfirmed(event.target.checked)}
                className="mt-1 h-4 w-4 accent-[var(--ember)]"
              />
              I reviewed the video, destination, title, caption, and provider-specific visibility.
            </label>
            <button
              type="button"
              disabled={busy || optionsBusy || !choice || !exportId || !title || !reviewConfirmed}
              onClick={() => void publish()}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-ink px-4 text-sm font-semibold text-surface-page disabled:opacity-50"
            >
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Confirm and send to {choice ? platformLabels[choice.destination.platform] : "provider"}
            </button>
          </div>
        </div>
      )}

      {error ? (
        <div role="alert" className="mx-5 mb-5 rounded-xl border border-danger/25 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {jobs.length ? (
        <div className="border-t border-line px-5 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-[.14em] text-ink-mute">Social publishing activity</div>
          <div className="mt-3 grid gap-2">
            {jobs.map((job) => (
              <div key={job.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-raised px-3 py-2.5 text-xs">
                <ConnectorIcon connectorId={job.platform} icon="video" />
                <span className="min-w-0 flex-1 truncate font-medium text-ink">{job.title}</span>
                <span className="inline-flex items-center gap-1.5 capitalize text-ink-soft">
                  <Check className="h-3.5 w-3.5" /> {job.status.replaceAll("_", " ")}
                </span>
                {job.provider_video_url ? (
                  <a href={job.provider_video_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-ember-ink">
                    Open <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

