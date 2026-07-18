import { useState } from "react";
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
import { SiYoutube } from "react-icons/si";
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
import { SelectField } from "@/components/ui/select-field";
import { getClipJobCreationContext } from "@/services/clipping/server";
import { ConnectorSettingsDialog } from "@/components/connectors/connector-settings-dialog";
import { ConnectorSettingsOverview } from "@/components/connectors/connector-settings-overview";
import { ConfirmationDialog } from "@/components/ui/status-dialog";

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
  const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(null);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
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
  const initialAutomationSnapshot = JSON.stringify({
    automationEnabled: existingRule?.enabled ?? false,
    sourceBehavior: existingRule?.source_behavior ?? "create_draft",
    requestedClips: existingRule?.requested_clip_count ?? 5,
    publishingBehavior: existingRule?.publishing_behavior ?? "do_not_publish",
    defaultPrivacy: existingRule?.default_privacy ?? "private",
    rightsAccepted: Boolean(existingRule?.rights_accepted_at),
  });
  const [savedAutomationSnapshot, setSavedAutomationSnapshot] = useState(initialAutomationSnapshot);
  const publishGranted = connection?.capabilities.includes("video_publish") ?? false;
  const connected = connection?.status === "connected" && Boolean(channel);
  const awaitingDrafts = data.drafts.filter((draft) => draft.status === "awaiting_source");
  const selectedConnector = data.catalog.find((item) => item.id === selectedConnectorId) ?? null;
  const automationSnapshot = JSON.stringify({
    automationEnabled,
    sourceBehavior,
    requestedClips,
    publishingBehavior,
    defaultPrivacy,
    rightsAccepted,
  });
  const automationDirty = Boolean(
    selectedConnector?.id === "youtube" && automationSnapshot !== savedAutomationSnapshot,
  );

  const run = async (label: string, action: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    setMessage(null);
    try {
      await action();
      await router.invalidate();
      return true;
    } catch (cause) {
      const friendly = userFacingError(cause, "The integration could not be updated.");
      setError(friendly);
      toast.error(friendly);
      return false;
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

  const saveAutomation = async () => {
    if (!channel) return false;
    const saved = await run("automation", async () => {
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
    if (saved) setSavedAutomationSnapshot(automationSnapshot);
    return saved;
  };

  return (
    <div className="space-y-6">
      <ConnectorSettingsOverview catalog={data.catalog} onOpen={setSelectedConnectorId} />
      {selectedConnector?.id === "youtube" ? (
        <ConnectorSettingsDialog
          connector={selectedConnector}
          open
          onOpenChange={(open) => {
            if (!open) setSelectedConnectorId(null);
          }}
          isDirty={automationDirty}
          saving={busy === "automation"}
          onSave={saveAutomation}
        >
          <div className="grid gap-0 lg:grid-cols-[1.15fr_.85fr]">
            <div className="p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-3">
                <StatusDot variant={connected ? "success" : connection ? "warning" : "muted"}>
                  {connected ? "Connected" : connection ? "Reconnect required" : "Not connected"}
                </StatusDot>
                <p className="text-sm leading-relaxed text-ink-soft">
                  Connection is optional for clipping. Connect only for channel monitoring,
                  automation, or publishing.
                </p>
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
                      onClick={() => setDisconnectOpen(true)}
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
                Manual jobs can import eligible attested media through the isolated worker. Channel
                automation creates a draft unless a mapped authorised source already exists.
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
                    {
                      value: "start_when_source_exists",
                      label: "Start when a mapped source exists",
                    },
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
                  onClick={() => void saveAutomation()}
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
        </ConnectorSettingsDialog>
      ) : selectedConnector ? (
        <ConnectorSettingsDialog
          connector={selectedConnector}
          open
          onOpenChange={(open) => {
            if (!open) setSelectedConnectorId(null);
          }}
        >
          <GenericConnectorSettings
            connector={selectedConnector}
            busy={busy}
            waitlisted={data.waitlist.some((item) => item.connectorId === selectedConnector.id)}
            onConnect={async () => {
              if (selectedConnector.authentication !== "oauth") return;
              await run(`connect:${selectedConnector.id}`, async () => {
                const result = await beginConnectorConnection({
                  data: {
                    connectorId: selectedConnector.id as OAuthConnectorId,
                    returnTo: "/app/settings/integrations",
                  },
                });
                window.location.assign(result.url);
              });
            }}
            onNotify={async () => {
              await run(`waitlist:${selectedConnector.id}`, async () => {
                await joinConnectorWaitlist({ data: { connectorId: selectedConnector.id } });
                setMessage(
                  "Connector interest saved. We’ll notify you when its authorised integration is ready.",
                );
              });
            }}
          />
        </ConnectorSettingsDialog>
      ) : null}

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

      {(message || error) && (
        <div
          role={error ? "alert" : "status"}
          className={`rounded-xl border px-4 py-3 text-sm ${error ? "border-danger/25 bg-danger/5 text-danger" : "border-success/25 bg-success/5 text-ink"}`}
        >
          {error ?? message}
        </div>
      )}
      <ConfirmationDialog
        open={disconnectOpen}
        onOpenChange={setDisconnectOpen}
        title="Disconnect YouTube?"
        description="This removes the encrypted connection and disables channel automation. Existing clips and exports are not deleted."
        confirmLabel="Disconnect"
        destructive
        busy={busy === "disconnect"}
        onConfirm={async () => {
          const disconnected = await run("disconnect", async () => {
            await disconnectYouTube();
            setMessage("YouTube disconnected.");
            toast.success("YouTube disconnected.");
          });
          if (disconnected) {
            setDisconnectOpen(false);
            setSelectedConnectorId(null);
          }
        }}
      />
    </div>
  );
}

function GenericConnectorSettings({
  connector,
  busy,
  waitlisted,
  onConnect,
  onNotify,
}: {
  connector: PublicConnectorDefinition;
  busy: string | null;
  waitlisted: boolean;
  onConnect: () => Promise<void>;
  onNotify: () => Promise<void>;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-ink">Capabilities</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {connector.capabilities.map((capability) => (
            <span
              key={capability}
              className="rounded-full border border-line bg-surface-sunken px-3 py-1 text-xs capitalize text-ink-soft"
            >
              {capability.replaceAll("_", " ")}
            </span>
          ))}
        </div>
      </div>
      <p className="text-sm leading-6 text-ink-soft">
        {connector.requiresOriginalSource
          ? "This provider requires an original source file before clipping can begin."
          : "This provider can supply an authorised source when its availability and connection requirements are met."}
      </p>
      <div className="flex flex-wrap gap-2">
        {connector.executable ? (
          <Link
            to="/app/youtube-clipper/new"
            search={{ source: connector.id }}
            className="rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-surface-page"
          >
            Use as source
          </Link>
        ) : null}
        {connector.authentication === "oauth" && connector.configured ? (
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => void onConnect()}
            className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-50"
          >
            {busy === `connect:${connector.id}`
              ? "Opening provider…"
              : connector.connected
                ? "Reconnect"
                : "Connect account"}
          </button>
        ) : null}
        {connector.availability === "coming_soon" || !connector.configured ? (
          <button
            type="button"
            disabled={waitlisted || Boolean(busy)}
            onClick={() => void onNotify()}
            className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ember-ink disabled:text-ink-mute"
          >
            {waitlisted
              ? "Interest recorded"
              : busy === `waitlist:${connector.id}`
                ? "Saving…"
                : "Notify me"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
