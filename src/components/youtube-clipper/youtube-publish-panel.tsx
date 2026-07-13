import { useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { CalendarClock, Check, LoaderCircle, Send } from "lucide-react";
import { SiYoutube } from "react-icons/si";
import { beginYouTubeConnection } from "@/services/youtube/oauth.server";
import { createYouTubePublishingJob } from "@/services/youtube/publishing.server";

type ExportItem = { id: string; status: string; export_type: string };
type Connection = {
  status: string;
  capabilities: string[];
  channels: { id: string; title: string; selected: boolean }[];
} | null;
type PublishingJob = {
  id: string;
  title: string;
  status: string;
  privacy_status: string;
  scheduled_for: string | null;
  provider_video_url: string | null;
  last_error_message: string | null;
};

export function YouTubePublishPanel({
  exports,
  connection,
  jobs,
  defaultTitle,
}: {
  exports: ExportItem[];
  connection: Connection;
  jobs: PublishingJob[];
  defaultTitle: string;
}) {
  const router = useRouter();
  const completed = exports.filter((item) => item.status === "complete");
  const channel = connection?.channels.find((item) => item.selected) ?? connection?.channels[0];
  const connected = connection?.status === "connected" && Boolean(channel);
  const publishGranted = connection?.capabilities.includes("video_publish") ?? false;
  const [exportId, setExportId] = useState(completed[0]?.id ?? "");
  const [title, setTitle] = useState(defaultTitle.slice(0, 100));
  const [description, setDescription] = useState("");
  const [privacy, setPrivacy] = useState<"private" | "unlisted" | "public">("private");
  const [madeForKids, setMadeForKids] = useState<boolean | null>(null);
  const [scheduled, setScheduled] = useState(false);
  const [scheduledFor, setScheduledFor] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!completed.length) return null;

  const grantPublishing = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await beginYouTubeConnection({
        data: { capability: "video_publish", returnTo: window.location.pathname },
      });
      window.location.assign(result.url);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "YouTube publishing access is unavailable.",
      );
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!channel || madeForKids === null) return;
    setBusy(true);
    setError(null);
    try {
      await createYouTubePublishingJob({
        data: {
          exportId,
          youtubeChannelId: channel.id,
          title,
          description,
          tags: [],
          categoryId: "22",
          madeForKids,
          privacyStatus: privacy,
          scheduledFor: scheduled && scheduledFor ? new Date(scheduledFor).toISOString() : null,
          idempotencyKey: crypto.randomUUID(),
        },
      });
      await router.invalidate();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The YouTube publishing job could not be created.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-8 overflow-hidden rounded-3xl border border-line bg-surface-panel">
      <div className="flex flex-col gap-4 border-b border-line bg-surface-raised px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ff0033] text-white">
            <SiYoutube className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display text-xl text-ink">Publish to YouTube</h2>
            <p className="mt-0.5 text-xs text-ink-mute">
              Private by default · explicit confirmation required
            </p>
          </div>
        </div>
        {channel && <span className="text-xs text-ink-soft">Destination: {channel.title}</span>}
      </div>

      {!connected ? (
        <div className="p-5 text-sm text-ink-soft">
          Connect a YouTube channel only when you are ready to publish. Clipping and downloading
          remain available without it.
          <Link to="/app/settings/integrations" className="ml-2 font-semibold text-ember-ink">
            Open integrations
          </Link>
        </div>
      ) : !publishGranted ? (
        <div className="p-5">
          <p className="text-sm text-ink-soft">
            Channel read access is connected. Grant the separate upload permission to publish.
          </p>
          <button
            type="button"
            onClick={() => void grantPublishing()}
            disabled={busy}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#ff0033] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}{" "}
            Grant publishing access
          </button>
        </div>
      ) : (
        <div className="grid gap-6 p-5 lg:grid-cols-[1fr_.8fr]">
          <div className="grid gap-4">
            <label className="grid gap-1.5 text-xs font-medium text-ink">
              Video export
              <select
                value={exportId}
                onChange={(event) => setExportId(event.target.value)}
                className="h-11 rounded-xl border border-line bg-surface-page px-3 text-sm font-normal"
              >
                {completed.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.export_type.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-ink">
              YouTube title
              <input
                value={title}
                maxLength={100}
                onChange={(event) => setTitle(event.target.value)}
                className="h-11 rounded-xl border border-line bg-surface-page px-3 text-sm font-normal"
              />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-ink">
              Description
              <textarea
                value={description}
                maxLength={5000}
                rows={4}
                onChange={(event) => setDescription(event.target.value)}
                className="rounded-xl border border-line bg-surface-page p-3 text-sm font-normal"
              />
            </label>
          </div>
          <div className="grid content-start gap-4">
            <label className="grid gap-1.5 text-xs font-medium text-ink">
              Privacy
              <select
                value={privacy}
                onChange={(event) => setPrivacy(event.target.value as typeof privacy)}
                className="h-11 rounded-xl border border-line bg-surface-page px-3 text-sm font-normal"
              >
                <option value="private">Private</option>
                <option value="unlisted">Unlisted</option>
                <option value="public">Public</option>
              </select>
            </label>
            <fieldset className="rounded-xl border border-line bg-surface-raised px-4 py-3">
              <legend className="px-1 text-xs font-medium text-ink">Audience</legend>
              <div className="mt-1 flex flex-wrap gap-4 text-sm text-ink">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="youtube-audience"
                    checked={madeForKids === false}
                    onChange={() => setMadeForKids(false)}
                    className="h-4 w-4 accent-[var(--ember)]"
                  />
                  Not made for kids
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="youtube-audience"
                    checked={madeForKids === true}
                    onChange={() => setMadeForKids(true)}
                    className="h-4 w-4 accent-[var(--ember)]"
                  />
                  Made for kids
                </label>
              </div>
            </fieldset>
            <label className="flex items-center gap-3 rounded-xl border border-line bg-surface-raised px-4 py-3 text-sm text-ink">
              <input
                type="checkbox"
                checked={scheduled}
                onChange={(event) => setScheduled(event.target.checked)}
                className="h-4 w-4 accent-[var(--ember)]"
              />{" "}
              Schedule for later
            </label>
            {scheduled && (
              <label className="grid gap-1.5 text-xs font-medium text-ink">
                Publish time
                <input
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(event) => setScheduledFor(event.target.value)}
                  className="h-11 rounded-xl border border-line bg-surface-page px-3 text-sm font-normal"
                />
              </label>
            )}
            <button
              type="button"
              onClick={() => void publish()}
              disabled={
                busy || !title || !exportId || madeForKids === null || (scheduled && !scheduledFor)
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-surface-page disabled:opacity-50"
            >
              {busy ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : scheduled ? (
                <CalendarClock className="h-4 w-4" />
              ) : (
                <SiYoutube className="h-4 w-4" />
              )}
              {scheduled ? "Schedule YouTube upload" : "Confirm and publish"}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mx-5 mb-5 rounded-xl border border-danger/25 bg-danger/5 px-4 py-3 text-sm text-danger"
        >
          {error}
        </div>
      )}

      {jobs.length > 0 && (
        <div className="border-t border-line px-5 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-[.14em] text-ink-mute">
            Publishing activity
          </div>
          <div className="mt-3 grid gap-2">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-raised px-3 py-2.5 text-xs"
              >
                <span className="min-w-0 flex-1 truncate font-medium text-ink">{job.title}</span>
                <span className="inline-flex items-center gap-1.5 capitalize text-ink-soft">
                  <Check className="h-3.5 w-3.5" />
                  {job.status.replaceAll("_", " ")}
                </span>
                <span className="capitalize text-ink-mute">{job.privacy_status}</span>
                {job.provider_video_url && (
                  <a
                    href={job.provider_video_url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-ember-ink"
                  >
                    Open video
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
