import { useState } from "react";
import { toast } from "sonner";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
  ArrowUpRight,
  BellRing,
  CalendarClock,
  Check,
  LoaderCircle,
  Radio,
  Scissors,
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
          contentClassName="max-w-4xl"
          bodyClassName="p-0 sm:p-0"
        >
          {!connected ? (
            <div data-testid="youtube-connection-setup" className="px-5 py-6 sm:px-8 sm:py-8">
              <section className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div>
                  <StatusDot variant={connection ? "warning" : "muted"}>
                    {connection ? "Reconnect required" : "Not connected"}
                  </StatusDot>
                  <h3 className="mt-4 font-display text-2xl text-ink">
                    Connect only when you need channel tools
                  </h3>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-ink-soft">
                    Pasting a public or unlisted YouTube URL for clipping does not require a channel
                    connection. Connect your account for upload monitoring and publishing controls.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:min-w-48">
                  <button
                    type="button"
                    onClick={() => void connect("channel_read")}
                    disabled={Boolean(busy)}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-surface-page disabled:opacity-60"
                  >
                    {busy === "channel_read" ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <SiYoutube className="h-4 w-4" />
                    )}
                    {connection ? "Reconnect YouTube" : "Connect YouTube"}
                  </button>
                  <Link
                    to="/app/youtube-clipper/new"
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink"
                  >
                    <Scissors className="h-4 w-4" /> Clip a URL instead
                  </Link>
                </div>
              </section>

              <section className="mt-7 border-t border-line pt-6">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-ember-ink">
                  <Radio className="h-4 w-4" /> Available after connection
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  {[
                    [BellRing, "Monitor uploads", "Detect new videos from the selected channel."],
                    [
                      Scissors,
                      "Prepare clip drafts",
                      "Choose how many clips each upload should create.",
                    ],
                    [
                      ShieldCheck,
                      "Control publishing",
                      "Review access, privacy, and publishing behavior.",
                    ],
                  ].map(([Icon, title, description]) => {
                    const FeatureIcon = Icon as typeof BellRing;
                    return (
                      <div key={String(title)} className="flex gap-3">
                        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-sunken text-ink-soft">
                          <FeatureIcon className="h-4 w-4" />
                        </span>
                        <div>
                          <div className="text-sm font-semibold text-ink">{String(title)}</div>
                          <p className="mt-1 text-xs leading-5 text-ink-mute">
                            {String(description)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          ) : channel ? (
            <div data-testid="youtube-connected-settings">
              <section className="flex flex-col gap-5 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
                <div className="flex min-w-0 items-center gap-3">
                  {channel.avatar_url ? (
                    <img
                      src={channel.avatar_url}
                      alt=""
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-surface-sunken">
                      <SiYoutube className="h-5 w-5 text-[#ff0033]" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate font-semibold text-ink">{channel.title}</div>
                      <StatusDot variant="success">Connected</StatusDot>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-mute">
                      <span className="inline-flex items-center gap-1">
                        <Check className="h-3.5 w-3.5 text-success" /> Channel read
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <ShieldCheck className="h-3.5 w-3.5" />{" "}
                        {publishGranted ? "Publishing granted" : "Publishing not granted"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={`https://www.youtube.com/channel/${channel.provider_channel_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-line px-3 text-xs font-semibold text-ink"
                  >
                    View channel <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => setDisconnectOpen(true)}
                    disabled={Boolean(busy)}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-line px-3 text-xs font-semibold text-ink disabled:opacity-60"
                  >
                    <Unplug className="h-3.5 w-3.5" /> Disconnect
                  </button>
                </div>
              </section>

              <section className="border-t border-line bg-surface-raised/65 px-5 py-6 sm:px-8 sm:py-7">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-ember-ink">
                      <Radio className="h-4 w-4" /> Channel automation
                    </div>
                    <h3 className="mt-2 font-display text-xl text-ink">New upload workflow</h3>
                    <p className="mt-1 text-sm text-ink-soft">
                      Prepare drafts from new channel uploads with review-first controls.
                    </p>
                  </div>
                  <label className="flex min-h-11 items-center justify-between gap-4 rounded-xl border border-line bg-surface-panel px-4">
                    <span className="text-sm font-semibold text-ink">Monitor uploads</span>
                    <input
                      type="checkbox"
                      checked={automationEnabled}
                      disabled={Boolean(busy)}
                      onChange={(event) => setAutomationEnabled(event.target.checked)}
                      className="h-4 w-4 accent-[var(--ember)]"
                    />
                  </label>
                </div>

                <fieldset
                  disabled={Boolean(busy)}
                  className="mt-6 grid gap-4 sm:grid-cols-2 disabled:opacity-55"
                >
                  <SelectField
                    label="When a new upload appears"
                    value={sourceBehavior}
                    onValueChange={setSourceBehavior}
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
                    options={[
                      { value: "private", label: "Private" },
                      { value: "unlisted", label: "Unlisted" },
                      { value: "public", label: "Public" },
                    ]}
                  />
                  {sourceBehavior === "start_when_source_exists" ? (
                    <label className="flex items-start gap-3 text-xs leading-relaxed text-ink-soft sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={rightsAccepted}
                        onChange={(event) => setRightsAccepted(event.target.checked)}
                        className="mt-0.5 h-4 w-4 accent-[var(--ember)]"
                      />
                      <span>
                        I confirm that mapped source media belongs to this managed channel and may
                        be processed under the current content policy.
                      </span>
                    </label>
                  ) : null}
                </fieldset>

                <div className="mt-6 flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
                  {!publishGranted ? (
                    <button
                      type="button"
                      onClick={() => void connect("video_publish")}
                      disabled={Boolean(busy)}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-surface-panel px-4 text-sm font-semibold text-ink disabled:opacity-60"
                    >
                      {busy === "video_publish" ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="h-4 w-4" />
                      )}
                      Grant publishing access
                    </button>
                  ) : (
                    <span className="text-xs text-ink-mute">
                      Publishing access is granted independently.
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={busy === "automation" || !automationDirty}
                    onClick={() => void saveAutomation()}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-ink px-5 text-sm font-semibold text-surface-page disabled:opacity-45"
                  >
                    {busy === "automation" ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Save automation
                  </button>
                </div>
              </section>
            </div>
          ) : null}
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
