import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
  ArrowUpRight,
  CalendarClock,
  Check,
  LoaderCircle,
  Radio,
  ShieldCheck,
  Unplug,
} from "lucide-react";
import { SiInstagram, SiTiktok, SiYoutube } from "react-icons/si";
import { z } from "zod";
import { userFacingError } from "@/lib/user-facing-error";
import { StatusDot } from "@/components/primitives/status-dot";
import {
  listYouTubeAutomationDrafts,
  saveYouTubeAutomationRule,
} from "@/services/youtube/automation.server";
import {
  beginYouTubeConnection,
  disconnectYouTube,
  getYouTubeConnection,
} from "@/services/youtube/oauth.server";
import {
  getPublicConnectorCatalog,
  joinConnectorWaitlist,
  listConnectorWaitlist,
} from "@/services/connectors/server";
import {
  beginConnectorConnection,
  type OAuthConnectorId,
} from "@/services/connectors/oauth.server";
import type { PublicConnectorDefinition } from "@/domain/connectors/types";
import { ConnectorIcon } from "@/components/connectors/connector-icon";
import { AvailabilityBadge } from "@/components/connectors/availability-badge";
import { SelectField } from "@/components/ui/select-field";
import { getClipJobCreationContext } from "@/services/clipping/server";

export const Route = createFileRoute("/_authenticated/app/settings/integrations")({
  validateSearch: z.object({ youtubeError: z.string().max(240).optional() }),
  loader: async () => {
    const [connection, drafts, catalog, waitlist, creationContext] = await Promise.all([
      getYouTubeConnection(),
      listYouTubeAutomationDrafts(),
      getPublicConnectorCatalog(),
      listConnectorWaitlist(),
      getClipJobCreationContext(),
    ]);
    return { connection, drafts, catalog, waitlist, creationContext };
  },
  component: Integrations,
});

type Channel = {
  id: string;
  provider_channel_id: string;
  title: string;
  avatar_url: string | null;
  selected: boolean;
};

type AutomationRule = {
  youtube_channel_id: string;
  enabled: boolean;
  source_behavior: string;
  requested_clip_count: number;
  duration_range: string;
  caption_preset: string;
  content_type: string;
  publishing_behavior: string;
  default_privacy: string;
  timezone: string;
  rights_accepted_at: string | null;
};

type Connection = {
  status: string;
  capabilities: string[];
  last_verified_at: string | null;
  channels: Channel[];
  rules: AutomationRule[];
};

type Draft = {
  id: string;
  provider_video_id: string;
  title: string;
  thumbnail_url: string | null;
  status: string;
  created_at: string;
};

function Integrations() {
  const data = Route.useLoaderData() as {
    connection: Connection | null;
    drafts: Draft[];
    catalog: PublicConnectorDefinition[];
    waitlist: { connectorId: string; createdAt: string }[];
    creationContext: Awaited<ReturnType<typeof getClipJobCreationContext>>;
  };
  const search = Route.useSearch();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(search.youtubeError ?? null);
  const connection = data.connection;
  const channel = connection?.channels.find((item) => item.selected) ?? connection?.channels[0];
  const existingRule = connection?.rules.find((rule) => rule.youtube_channel_id === channel?.id);
  const [automationEnabled, setAutomationEnabled] = useState(existingRule?.enabled ?? false);
  const [sourceBehavior, setSourceBehavior] = useState(
    existingRule?.source_behavior ?? "create_draft",
  );
  const [requestedClips, setRequestedClips] = useState(existingRule?.requested_clip_count ?? 5);
  const [publishingBehavior, setPublishingBehavior] = useState(
    existingRule?.publishing_behavior ?? "do_not_publish",
  );
  const [defaultPrivacy, setDefaultPrivacy] = useState(existingRule?.default_privacy ?? "private");
  const [rightsAccepted, setRightsAccepted] = useState(Boolean(existingRule?.rights_accepted_at));
  const publishGranted = connection?.capabilities.includes("video_publish") ?? false;
  const connected = connection?.status === "connected" && Boolean(channel);
  const awaitingDrafts = data.drafts.filter((draft) => draft.status === "awaiting_source");

  const run = async (label: string, action: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    setMessage(null);
    try {
      await action();
      await router.invalidate();
    } catch (cause) {
      const friendly = userFacingError(cause, "The integration could not be updated.");
      setError(friendly);
      toast.error(friendly);
    } finally {
      setBusy(null);
    }
  };

  const connect = (capability: "channel_read" | "video_publish") =>
    run(capability, async () => {
      const result = await beginYouTubeConnection({
        data: { capability, returnTo: "/app/settings/integrations" },
      });
      window.location.assign(result.url);
    });

  const saveAutomation = () => {
    if (!channel) return;
    void run("automation", async () => {
      await saveYouTubeAutomationRule({
        data: {
          youtubeChannelId: channel.id,
          rule: {
            enabled: automationEnabled,
            sourceBehavior: sourceBehavior as "create_draft" | "start_when_source_exists",
            requestedClipCount: requestedClips,
            durationRange:
              existingRule?.duration_range === "15-30 seconds" ||
              existingRule?.duration_range === "60-90 seconds"
                ? existingRule.duration_range
                : "30-60 seconds",
            captionPreset: existingRule?.caption_preset ?? "Clean editorial",
            contentType: existingRule?.content_type ?? "Video",
            publishingBehavior: publishingBehavior as
              "do_not_publish" | "queue_for_review" | "schedule_approved",
            defaultPrivacy: defaultPrivacy as "private" | "unlisted" | "public",
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
            rightsAccepted,
          },
        },
      });
      setMessage(
        automationEnabled
          ? "Automation saved. YouTube is verifying the channel subscription."
          : "Automation paused.",
      );
      toast.success(automationEnabled ? "YouTube automation saved." : "YouTube automation paused.");
    });
  };

  return (
    <div className="space-y-6">
      <ConnectorSettingsOverview
        catalog={data.catalog}
        waitlist={data.waitlist.map((item) => item.connectorId)}
        onNotify={(connectorId) =>
          run(`waitlist:${connectorId}`, async () => {
            await joinConnectorWaitlist({ data: { connectorId } });
            setMessage(
              "Connector interest saved. We’ll notify you when its authorised integration is ready.",
            );
          })
        }
        onConnect={(connectorId) =>
          run(`connect:${connectorId}`, async () => {
            const result = await beginConnectorConnection({
              data: { connectorId, returnTo: "/app/settings/integrations" },
            });
            window.location.assign(result.url);
          })
        }
        busy={busy}
      />
      <section className="overflow-hidden rounded-3xl border border-line bg-surface-panel">
        <div className="grid gap-0 lg:grid-cols-[1.15fr_.85fr]">
          <div className="p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <a
                href={
                  channel
                    ? `https://www.youtube.com/channel/${channel.provider_channel_id}`
                    : "https://www.youtube.com"
                }
                target="_blank"
                rel="noreferrer"
                aria-label="Open YouTube"
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#ff0033] text-white shadow-[0_12px_35px_rgba(255,0,51,.2)]"
              >
                <SiYoutube className="h-7 w-7" />
              </a>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="font-display text-2xl text-ink">YouTube</h2>
                  <StatusDot variant={connected ? "success" : connection ? "warning" : "muted"}>
                    {connected ? "Connected" : connection ? "Reconnect required" : "Not connected"}
                  </StatusDot>
                </div>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
                  Connection is optional for clipping. Connect only when you want channel upload
                  detection, automation, or publishing.
                </p>
              </div>
            </div>

            {connected && channel ? (
              <div className="mt-7 rounded-2xl border border-line bg-surface-raised p-4">
                <div className="flex items-center gap-3">
                  {channel.avatar_url ? (
                    <img
                      src={channel.avatar_url}
                      alt=""
                      className="h-11 w-11 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-sunken">
                      <SiYoutube className="h-5 w-5 text-[#ff0033]" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-ink">{channel.title}</div>
                    <div className="mt-0.5 truncate text-xs text-ink-mute">
                      {channel.provider_channel_id}
                    </div>
                  </div>
                  <a
                    href={`https://www.youtube.com/channel/${channel.provider_channel_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-line p-2 text-ink-mute hover:text-ink"
                    aria-label="Open connected YouTube channel"
                  >
                    <ArrowUpRight className="h-4 w-4" />
                  </a>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1.5 text-ink">
                    <Check className="h-3.5 w-3.5 text-success" /> Channel read
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ${publishGranted ? "bg-success/10 text-ink" : "bg-surface-sunken text-ink-mute"}`}
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />{" "}
                    {publishGranted ? "Publishing granted" : "Publishing not granted"}
                  </span>
                </div>
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-2">
              {!connected ? (
                <button
                  type="button"
                  onClick={() => void connect("channel_read")}
                  disabled={Boolean(busy)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-surface-page disabled:opacity-60"
                >
                  {busy === "channel_read" ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <SiYoutube className="h-4 w-4" />
                  )}
                  {connection ? "Reconnect YouTube" : "Connect YouTube"}
                </button>
              ) : (
                <>
                  {!publishGranted && (
                    <button
                      type="button"
                      onClick={() => void connect("video_publish")}
                      disabled={Boolean(busy)}
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#ff0033] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {busy === "video_publish" ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" />
                      )}
                      Grant publishing access
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      void run("disconnect", async () => {
                        if (!window.confirm("Disconnect YouTube and disable channel automation?"))
                          return;
                        await disconnectYouTube();
                        setMessage("YouTube disconnected.");
                        toast.success("YouTube disconnected.");
                      })
                    }
                    disabled={Boolean(busy)}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-ink disabled:opacity-60"
                  >
                    <Unplug className="h-4 w-4" /> Disconnect
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="border-t border-line bg-surface-raised p-6 sm:p-8 lg:border-l lg:border-t-0">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-ember-ink">
              <Radio className="h-4 w-4" /> Channel automation
            </div>
            <h3 className="mt-3 font-display text-xl text-ink">New upload workflow</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              External uploads create a draft awaiting the original source. Vidrial never downloads
              the YouTube playback stream.
            </p>
            {!connected ? (
              <p
                role="status"
                className="mt-4 rounded-xl border border-line bg-surface-panel px-4 py-3 text-sm text-ink-soft"
              >
                Connect YouTube to configure channel monitoring and publishing automation.
              </p>
            ) : null}
            <fieldset
              disabled={!connected || Boolean(busy)}
              className="mt-5 space-y-4 disabled:opacity-55"
            >
              <label className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-panel px-4 py-3">
                <span className="text-sm font-medium text-ink">Monitor new uploads</span>
                <input
                  type="checkbox"
                  checked={automationEnabled}
                  onChange={(event) => setAutomationEnabled(event.target.checked)}
                  className="h-4 w-4 accent-[var(--ember)]"
                />
              </label>
              <SelectField
                label="When a new upload appears"
                value={sourceBehavior}
                onValueChange={setSourceBehavior}
                disabled={!connected || Boolean(busy)}
                options={[
                  { value: "create_draft", label: "Create draft and request source" },
                  { value: "start_when_source_exists", label: "Start when a mapped source exists" },
                ]}
              />
              <SelectField
                label="Clips per upload"
                value={String(requestedClips)}
                onValueChange={(value) => setRequestedClips(Number(value))}
                disabled={!connected || Boolean(busy)}
                options={[1, 2, 3, 4, 5, 10, 20, 50].map((count) => ({
                  value: String(count),
                  label: `${count} ${count === 1 ? "clip" : "clips"}`,
                  badge: count > 20 ? "Pro" : count > 5 ? "Creator" : undefined,
                  disabled: count > data.creationContext.entitlement.maxClipsPerJob,
                  description:
                    count > data.creationContext.entitlement.maxClipsPerJob
                      ? `Available on ${count > 20 ? "Pro" : "Creator"}`
                      : undefined,
                }))}
                hint={`${data.creationContext.entitlement.maxClipsPerJob} clips per upload on ${data.creationContext.plan}.`}
              />
              <SelectField
                label="After clips are ready"
                value={publishingBehavior}
                onValueChange={setPublishingBehavior}
                disabled={!connected || Boolean(busy)}
                options={[
                  { value: "do_not_publish", label: "Do not publish automatically" },
                  { value: "queue_for_review", label: "Queue for review" },
                  { value: "schedule_approved", label: "Schedule approved clips" },
                ]}
              />
              <SelectField
                label="Default YouTube privacy"
                value={defaultPrivacy}
                onValueChange={setDefaultPrivacy}
                disabled={!connected || Boolean(busy)}
                options={[
                  { value: "private", label: "Private" },
                  { value: "unlisted", label: "Unlisted" },
                  { value: "public", label: "Public" },
                ]}
              />
              {sourceBehavior === "start_when_source_exists" && (
                <label className="flex items-start gap-3 text-xs leading-relaxed text-ink-soft">
                  <input
                    type="checkbox"
                    checked={rightsAccepted}
                    onChange={(event) => setRightsAccepted(event.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[var(--ember)]"
                  />
                  <span>
                    I confirm that mapped source media belongs to this managed channel and may be
                    processed under the current content policy.
                  </span>
                </label>
              )}
              <button
                type="button"
                onClick={saveAutomation}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-surface-page"
              >
                {busy === "automation" ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Save automation
              </button>
            </fieldset>
          </div>
        </div>
      </section>

      {awaitingDrafts.length > 0 && (
        <section className="rounded-3xl border border-line bg-surface-panel p-6 sm:p-8">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-ember-ink">
            <CalendarClock className="h-4 w-4" /> Source needed
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {awaitingDrafts.map((draft) => (
              <article
                key={draft.id}
                className="flex gap-3 rounded-2xl border border-line bg-surface-raised p-3"
              >
                {draft.thumbnail_url ? (
                  <img
                    src={draft.thumbnail_url}
                    alt=""
                    className="h-20 w-32 rounded-xl object-cover"
                  />
                ) : null}
                <div className="min-w-0 flex-1 py-1">
                  <h3 className="line-clamp-2 text-sm font-medium text-ink">{draft.title}</h3>
                  <p className="mt-1 text-xs text-ink-mute">
                    Detected upload · original file required
                  </p>
                  <Link
                    to="/app/youtube-clipper/new"
                    search={{
                      youtube: `https://youtube.com/watch?v=${draft.provider_video_id}`,
                      draft: draft.id,
                    }}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-ember-ink"
                  >
                    Add authorised source <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <UpcomingIntegration
          icon={SiTiktok}
          name="TikTok"
          body="Publishing and channel automation are planned after YouTube production verification."
        />
        <UpcomingIntegration
          icon={SiInstagram}
          name="Instagram"
          body="Reels publishing will use the same durable review and scheduling model."
        />
      </div>

      {(message || error) && (
        <div
          role={error ? "alert" : "status"}
          className={`rounded-xl border px-4 py-3 text-sm ${error ? "border-danger/25 bg-danger/5 text-danger" : "border-success/25 bg-success/5 text-ink"}`}
        >
          {error ?? message}
        </div>
      )}
    </div>
  );
}

function ConnectorSettingsOverview({
  catalog,
  waitlist,
  onNotify,
  onConnect,
  busy,
}: {
  catalog: PublicConnectorDefinition[];
  waitlist: string[];
  onNotify: (connectorId: string) => Promise<void>;
  onConnect: (connectorId: OAuthConnectorId) => Promise<void>;
  busy: string | null;
}) {
  const connected = catalog.filter((connector) => connector.connected);
  const importSources = catalog.filter(
    (connector) =>
      connector.availability === "available" &&
      connector.id !== "youtube" &&
      connector.category !== "developer_automation",
  );
  const setupRequired = catalog.filter((connector) => connector.availability === "beta");
  const planned = catalog.filter((connector) => connector.availability === "coming_soon");
  const developer = catalog.filter((connector) => connector.category === "developer_automation");
  const publishing = ["youtube", "instagram", "facebook", "tiktok", "linkedin", "x"]
    .map((id) => catalog.find((connector) => connector.id === id))
    .filter((connector): connector is PublicConnectorDefinition => Boolean(connector));

  const card = (connector: PublicConnectorDefinition, action?: "import" | "notify" | "connect") => (
    <article key={connector.id} className="rounded-2xl border border-line bg-surface-raised p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-sunken text-ink-soft">
          <ConnectorIcon connectorId={connector.id} icon={connector.icon} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-ink">{connector.label}</h3>
            {connector.connected ? (
              <StatusDot variant="success">Connected</StatusDot>
            ) : (
              <AvailabilityBadge availability={connector.availability} compact />
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-ink-mute">
            {connector.description}
          </p>
        </div>
      </div>
      {action === "import" ? (
        <Link
          to="/app/youtube-clipper/new"
          search={{ source: connector.id }}
          className="mt-4 inline-flex text-xs font-semibold text-ember-ink"
        >
          Use source
        </Link>
      ) : null}
      {action === "notify" ? (
        <button
          type="button"
          disabled={waitlist.includes(connector.id) || Boolean(busy)}
          onClick={() => void onNotify(connector.id)}
          className="mt-4 inline-flex text-xs font-semibold text-ember-ink disabled:text-ink-mute"
        >
          {waitlist.includes(connector.id)
            ? "Interest recorded"
            : busy === `waitlist:${connector.id}`
              ? "Saving…"
              : "Notify me"}
        </button>
      ) : null}
      {action === "connect" ? (
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => void onConnect(connector.id as OAuthConnectorId)}
          className="mt-4 inline-flex text-xs font-semibold text-ember-ink disabled:text-ink-mute"
        >
          {busy === `connect:${connector.id}`
            ? "Opening provider…"
            : connector.connected
              ? "Reconnect"
              : "Connect account"}
        </button>
      ) : null}
    </article>
  );

  return (
    <section className="rounded-3xl border border-line bg-surface-panel p-6 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-ember-ink">
            Source connections
          </p>
          <h1 className="mt-2 font-display text-2xl text-ink">Integrations</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">
            Import sources, publishing destinations, automation, and developer connections remain
            separate permission boundaries.
          </p>
        </div>
        <Link
          to="/app/youtube-clipper/new"
          className="rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-surface-page"
        >
          Import media
        </Link>
      </div>

      <div className="mt-7 space-y-7">
        <SettingsGroup
          title="Connected sources"
          description="Provider tokens stay encrypted server-side and never enter the browser bundle."
        >
          {connected.length ? (
            connected.map((connector) => card(connector))
          ) : (
            <EmptyConnectorRow>
              There are no connected source accounts. Local upload, direct HTTPS links, and public
              RSS do not require a connection.
            </EmptyConnectorRow>
          )}
        </SettingsGroup>
        <SettingsGroup
          title="Available sources"
          description="These source paths can start an honest import in the current application."
        >
          {importSources.map((connector) => card(connector, "import"))}
        </SettingsGroup>
        <SettingsGroup
          title="Provider beta setup"
          description="Adapters are catalogued, but execution remains disabled until credentials and provider verification are complete."
        >
          {setupRequired
            .slice(0, 6)
            .map((connector) =>
              card(
                connector,
                connector.configured &&
                  ["google_drive", "dropbox", "onedrive"].includes(connector.id)
                  ? "connect"
                  : "notify",
              ),
            )}
        </SettingsGroup>
        <SettingsGroup
          title="Publishing destinations"
          description="Publishing always requires a separate connection and a final user review."
        >
          {publishing.map((connector) =>
            card(connector, connector.availability === "coming_soon" ? "notify" : undefined),
          )}
        </SettingsGroup>
        <SettingsGroup
          title="Developer integrations"
          description="Signed webhook delivery, scoped API keys, retries, and delivery logs must ship before these become available."
        >
          {developer.map((connector) => card(connector, "notify"))}
        </SettingsGroup>
        <SettingsGroup
          title="Coming soon"
          description={`${planned.length} planned connectors are visible without fake OAuth or simulated connection state.`}
        >
          {planned
            .filter((connector) => connector.category !== "developer_automation")
            .slice(0, 6)
            .map((connector) => card(connector, "notify"))}
        </SettingsGroup>
      </div>
    </section>
  );
}

function SettingsGroup({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-ink-mute">{description}</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </div>
  );
}

function EmptyConnectorRow({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-line px-4 py-5 text-xs leading-5 text-ink-mute md:col-span-2 xl:col-span-3">
      {children}
    </p>
  );
}

function UpcomingIntegration({
  icon: Icon,
  name,
  body,
}: {
  icon: typeof SiTiktok;
  name: string;
  body: string;
}) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-line bg-surface-panel p-5">
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-surface-sunken" />
      <div className="relative flex items-start gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface-page text-ink">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg text-ink">{name}</h2>
            <StatusDot variant="muted">Coming soon</StatusDot>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{body}</p>
        </div>
      </div>
    </article>
  );
}
