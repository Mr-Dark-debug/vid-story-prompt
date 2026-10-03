import { createFileRoute, useRouter } from "@tanstack/react-router";
import { LockKeyhole } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AddKeyDialog } from "@/components/ai/add-key-dialog";
import { DefaultModelsPanel } from "@/components/ai/default-models-panel";
import { ProviderCard, type ConnectionAction } from "@/components/ai/provider-card";
import { ConfirmationDialog } from "@/components/ui/status-dialog";
import { userFacingError } from "@/lib/user-facing-error";
import {
  connectAiProvider,
  deleteAiProvider,
  getAiPreferences,
  getAiProviderOverview,
  listAiModels,
  refreshAiModels,
  replaceAiProviderKey,
  revalidateAiProvider,
  revokeAiProvider,
  type AiConnection,
} from "@/services/ai/server";

export const Route = createFileRoute("/_authenticated/app/settings/ai-providers")({
  head: () => ({
    meta: [
      { title: "AI providers — Vidrial" },
      { name: "description", content: "Connect your own AI provider keys." },
    ],
  }),
  loader: async () => {
    const [overview, models, preferences] = await Promise.all([
      getAiProviderOverview(),
      listAiModels(),
      getAiPreferences(),
    ]);
    return { overview, models, preferences };
  },
  component: AiProvidersSettings,
});

type DialogState = { providerId: string; mode: "add" | "replace"; credentialId?: string };
type ConfirmState = { connection: AiConnection; action: "revoke" | "delete" };

function AiProvidersSettings() {
  const { overview, models, preferences } = Route.useLoaderData();
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const refresh = () => void router.invalidate();

  const dialogProvider = dialog
    ? (overview.providers.find((provider) => provider.id === dialog.providerId) ?? null)
    : null;

  async function runAction(connection: AiConnection, action: ConnectionAction) {
    if (action === "replace") {
      setDialog({
        providerId: connection.providerId,
        mode: "replace",
        credentialId: connection.id,
      });
      return;
    }
    if (action === "revoke" || action === "delete") {
      setConfirm({ connection, action });
      return;
    }
    setBusyId(connection.id);
    try {
      if (action === "refresh") {
        const result = await refreshAiModels({
          data: { credentialId: connection.id, force: true },
        });
        toast.success(
          result.refreshed
            ? `Loaded ${result.modelCount} models.`
            : "Models are already up to date.",
        );
      } else {
        const result = await revalidateAiProvider({ data: { credentialId: connection.id } });
        if (result.status === "active") toast.success("The provider accepted this key.");
        else toast.error("The provider rejected this key. Replace it to keep using it.");
      }
    } catch (cause) {
      toast.error(userFacingError(cause, "That did not work. Try again."));
    } finally {
      setBusyId(null);
      refresh();
    }
  }

  async function confirmAction() {
    if (!confirm) return;
    const { connection, action } = confirm;
    setBusyId(connection.id);
    try {
      if (action === "revoke") await revokeAiProvider({ data: { credentialId: connection.id } });
      else await deleteAiProvider({ data: { credentialId: connection.id } });
      toast.success(action === "revoke" ? "Key revoked and erased." : "Connection deleted.");
    } catch (cause) {
      toast.error(userFacingError(cause, "That did not work. Try again."));
    } finally {
      setBusyId(null);
      setConfirm(null);
      refresh();
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex gap-3 rounded-xl border border-line bg-surface-sunken p-4 text-sm text-ink-soft">
        <LockKeyhole aria-hidden className="mt-0.5 size-4 shrink-0 text-ink" />
        <div className="grid gap-1">
          <p>
            Bring your own provider key to chat with, and later plan clips with, models you already
            pay for. Keys are encrypted before storage, used only for requests you start, and can be
            revoked at any time.
          </p>
          <p className="text-xs text-ink-mute">
            Your own key replaces Vidrial&rsquo;s model cost, not its processing: transcription,
            rendering, storage and source-minute limits still follow your plan.
          </p>
        </div>
      </div>

      {!overview.encryptionConfigured ? (
        <div
          role="alert"
          className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-ink"
        >
          Saving provider keys is not set up on this deployment yet, so connecting is disabled.
        </div>
      ) : null}

      <DefaultModelsPanel
        purposes={[
          {
            purpose: "chat",
            description: "Used when you start a new chat.",
            noneLabel: "Choose each time",
          },
          {
            purpose: "clip_planning",
            description:
              "Ranks and explains clip candidates. Transcript text from your sources is sent to this provider; source-minute limits still follow your plan.",
            noneLabel: "Built-in selection",
          },
          {
            purpose: "social_copy",
            description: "Writes clip titles and platform copy, including background runs.",
            noneLabel: "Vidrial's built-in model, if available",
          },
          {
            purpose: "editor_plan",
            description: "Plans timeline edits in the AI editor for existing projects.",
            noneLabel: "Vidrial's built-in model, if available",
          },
        ]}
        groups={models}
        preferences={preferences}
        onSaved={refresh}
      />

      <div className="grid gap-4">
        {overview.providers.map((provider) => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            connections={overview.connections.filter((item) => item.providerId === provider.id)}
            busyId={busyId}
            canAdd={overview.encryptionConfigured}
            onAdd={() => setDialog({ providerId: provider.id, mode: "add" })}
            onAction={(connection, action) => void runAction(connection, action)}
          />
        ))}
      </div>

      <AddKeyDialog
        provider={dialogProvider}
        mode={dialog?.mode ?? "add"}
        onOpenChange={(open) => !open && setDialog(null)}
        onSubmit={async ({ label, apiKey }) => {
          if (!dialog) return;
          if (dialog.mode === "replace" && dialog.credentialId) {
            await replaceAiProviderKey({ data: { credentialId: dialog.credentialId, apiKey } });
            toast.success("Key replaced and verified.");
          } else {
            const result = await connectAiProvider({
              data: { providerId: dialog.providerId, label, apiKey },
            });
            toast.success(
              result.modelCount === null
                ? "Key saved. Models could not be loaded yet; use Refresh models."
                : `Key verified. ${result.modelCount} models available.`,
            );
          }
          refresh();
        }}
      />

      <ConfirmationDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        busy={busyId !== null}
        destructive
        title={confirm?.action === "revoke" ? "Revoke this key?" : "Delete this connection?"}
        description={
          confirm?.action === "revoke"
            ? "The stored key is erased and its default models are cleared. Chats stay, but need another key to continue."
            : "The connection and its cached models are removed. Chats that used it stay, but need another key to continue."
        }
        confirmLabel={confirm?.action === "revoke" ? "Revoke key" : "Delete connection"}
        onConfirm={confirmAction}
      />
    </div>
  );
}
