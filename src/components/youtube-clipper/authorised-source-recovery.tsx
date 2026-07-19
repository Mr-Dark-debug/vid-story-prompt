import { useState } from "react";
import { Link2, LoaderCircle, ShieldCheck } from "lucide-react";
import { SourcePicker } from "@/components/connectors/source-picker";
import { StatusDialog } from "@/components/ui/status-dialog";
import { Button } from "@/components/ui/button";
import { CONNECTOR_REGISTRY, getConnector } from "@/domain/connectors/registry";
import type { PublicConnectorDefinition, RemoteMediaAsset } from "@/domain/connectors/types";
import {
  attachDirectSourceAndResumeClipJob,
  attachSourceAndResumeClipJob,
} from "@/services/clipping/server";
import {
  cancelConnectorImport,
  createConnectorImport,
  getConnectorImportProgress,
} from "@/services/connectors/assets.server";
import { userFacingError } from "@/lib/user-facing-error";
import { CloudAssetBrowser } from "./job-wizard";
import { SourceUpload, type UploadedSource } from "./source-upload";
import { LocalRelayRecovery } from "./local-relay-recovery";

const RECOVERY_CONNECTOR_IDS = [
  "local_upload",
  "direct_url",
  "google_drive",
  "dropbox",
  "onedrive",
] as const;
const recoveryConnectors = CONNECTOR_REGISTRY.filter((connector) =>
  RECOVERY_CONNECTOR_IDS.some((id) => id === connector.id),
);
type AssetRecoveryConnectorId = Exclude<(typeof RECOVERY_CONNECTOR_IDS)[number], "direct_url">;

type PendingConfirmation = {
  assetId: string;
  connectorId: AssetRecoveryConnectorId;
  connectorImportId: string | null;
  idempotencyKey: string;
  expected: number | null;
  actual: number | null;
  reason: string;
};

export function AuthorisedSourceRecovery({
  jobId,
  sourceAssetId,
  errorCode,
  connectedConnectorIds,
  onResumed,
}: {
  jobId: string;
  sourceAssetId: string | null;
  errorCode: string | null;
  connectedConnectorIds: readonly string[];
  onResumed: () => Promise<void> | void;
}) {
  const [connectorId, setConnectorId] = useState("local_upload");
  const [uploaded, setUploaded] = useState<UploadedSource | null>(null);
  const [directUrl, setDirectUrl] = useState("");
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [remoteAsset, setRemoteAsset] = useState<RemoteMediaAsset | null>(null);
  const [importId, setImportId] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<{
    status: string;
    bytesTransferred: number;
    bytesTotal: number | null;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(null);

  const selectedDefinition = getConnector(connectorId)!;
  const runtimeConnector: PublicConnectorDefinition = {
    ...selectedDefinition,
    connected: connectedConnectorIds.includes(connectorId),
    configured: true,
    executable: true,
  };

  const attachAsset = async (
    assetId: string,
    sourceConnectorId: AssetRecoveryConnectorId,
    connectorImportId: string | null,
    idempotencyKey: string = crypto.randomUUID(),
    confirmMismatch = false,
  ) => {
    setBusy(true);
    setError(null);
    try {
      const result = await attachSourceAndResumeClipJob({
        data: {
          jobId,
          mediaAssetId: assetId,
          connectorId: sourceConnectorId,
          connectorImportId,
          idempotencyKey,
          confirmMismatch,
        },
      });
      if (result.status === "confirmation_required") {
        setConfirmation({
          assetId,
          connectorId: sourceConnectorId,
          connectorImportId,
          idempotencyKey,
          expected: result.expectedDurationSeconds ?? null,
          actual: result.actualDurationSeconds ?? null,
          reason: result.matchReason ?? "The durations differ.",
        });
        return;
      }
      await onResumed();
    } catch (cause) {
      setError(userFacingError(cause, "The source could not be attached. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const importCloudAsset = async () => {
    if (!remoteAsset) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createConnectorImport({
        data: {
          connectorId: connectorId as "google_drive" | "dropbox" | "onedrive",
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
      setImportId(created.importId);
      for (;;) {
        const progress = await getConnectorImportProgress({ data: { importId: created.importId } });
        setImportProgress(progress);
        if (progress.status === "ready" && progress.assetId) {
          await attachAsset(
            progress.assetId,
            connectorId as AssetRecoveryConnectorId,
            created.importId,
          );
          break;
        }
        if (["failed", "cancelled"].includes(progress.status))
          throw new Error(progress.errorMessage ?? `The connector import ${progress.status}.`);
        await new Promise((resolve) => window.setTimeout(resolve, 1_000));
      }
    } catch (cause) {
      setError(userFacingError(cause, "The connected source could not be imported."));
    } finally {
      setBusy(false);
    }
  };

  const resumeDirect = async () => {
    setBusy(true);
    setError(null);
    try {
      await attachDirectSourceAndResumeClipJob({
        data: { jobId, sourceUrl: directUrl, idempotencyKey: crypto.randomUUID() },
      });
      await onResumed();
    } catch (cause) {
      setError(userFacingError(cause, "The owner-controlled media link could not be attached."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-5 rounded-2xl border border-warning/30 bg-warning/5 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-panel text-warning shadow-sm">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-ink">Add the original source to continue</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-soft">
            Automatic YouTube retrieval stopped. Attach the matching original file or an
            owner-controlled media link here. Your clip settings, history, and existing usage
            reservation stay on this job.
          </p>
        </div>
      </div>

      <LocalRelayRecovery jobId={jobId} onQueued={onResumed} />

      {errorCode === "source_match_confirmation_required" && sourceAssetId ? (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-warning/30 bg-surface-panel p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink-soft">
            Worker validation found a shorter file. Confirm it only if this is the intended source.
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() =>
              void attachAsset(sourceAssetId, "local_upload", null, crypto.randomUUID(), true)
            }
          >
            Continue with this file
          </Button>
        </div>
      ) : null}

      <div className="mt-5">
        <SourcePicker
          value={connectorId}
          connectors={recoveryConnectors}
          connectedIds={connectedConnectorIds}
          onChange={(connector) => {
            setConnectorId(connector.id);
            setError(null);
            setRemoteAsset(null);
          }}
        />
      </div>

      <div className="mt-4">
        {connectorId === "local_upload" ? (
          <div className="space-y-3">
            <SourceUpload onUploaded={setUploaded} />
            {uploaded ? (
              <Button
                type="button"
                disabled={!rightsConfirmed || busy}
                loading={busy}
                onClick={() => void attachAsset(uploaded.assetId, "local_upload", null)}
              >
                Attach file and resume
              </Button>
            ) : null}
          </div>
        ) : null}

        {connectorId === "direct_url" ? (
          <div className="rounded-2xl border border-line bg-surface-panel p-4">
            <label className="grid gap-2 text-sm font-medium text-ink">
              Owner-controlled HTTPS media URL
              <span className="flex h-12 items-center gap-2 rounded-xl border border-line bg-surface-page px-3 focus-within:ring-2 focus-within:ring-ember">
                <Link2 className="h-4 w-4 text-ink-mute" />
                <input
                  type="url"
                  value={directUrl}
                  onChange={(event) => setDirectUrl(event.target.value)}
                  placeholder="https://media.example.com/original.mp4"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
              </span>
            </label>
            <Button
              type="button"
              className="mt-3"
              disabled={!rightsConfirmed || !directUrl || busy}
              loading={busy}
              onClick={() => void resumeDirect()}
            >
              Securely import and resume
            </Button>
          </div>
        ) : null}

        {["google_drive", "dropbox", "onedrive"].includes(connectorId) ? (
          <div className="rounded-2xl border border-line bg-surface-panel p-4">
            <CloudAssetBrowser
              connector={runtimeConnector}
              selected={remoteAsset}
              onSelect={setRemoteAsset}
              importProgress={importProgress}
              importing={Boolean(importId) && busy}
              onCancel={async () => {
                if (!importId) return;
                await cancelConnectorImport({ data: { importId } });
                setImportId(null);
                setImportProgress(null);
              }}
            />
            {remoteAsset ? (
              <Button
                type="button"
                className="mt-3"
                disabled={!rightsConfirmed || busy}
                onClick={() => void importCloudAsset()}
              >
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                Import file and resume
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface-panel p-4 focus-within:ring-2 focus-within:ring-ember">
        <input
          type="checkbox"
          checked={rightsConfirmed}
          onChange={(event) => setRightsConfirmed(event.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[var(--ember)]"
        />
        <span className="text-sm text-ink">
          I own this replacement source or have permission to upload, edit, and export it.
        </span>
      </label>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <StatusDialog
        open={Boolean(confirmation)}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
        variant="warning"
        title="This file may not match"
        description={confirmation?.reason ?? "The selected file differs from the YouTube source."}
        detail={
          confirmation ? (
            <span>
              Expected about {Math.round(confirmation.expected ?? 0)}s · file is{" "}
              {Math.round(confirmation.actual ?? 0)}s
            </span>
          ) : null
        }
        secondaryAction={{ label: "Choose another file", onClick: () => setConfirmation(null) }}
        primaryAction={{
          label: "Use this shorter file",
          loading: busy,
          onClick: () => {
            if (!confirmation) return;
            void attachAsset(
              confirmation.assetId,
              confirmation.connectorId,
              confirmation.connectorImportId,
              confirmation.idempotencyKey,
              true,
            );
          },
        }}
      />
    </section>
  );
}
