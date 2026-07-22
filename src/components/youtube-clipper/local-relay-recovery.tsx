import { useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
  Copy,
  Laptop,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/status-dialog";
import {
  createRelayPairing,
  listRelayDevices,
  revokeRelayDevice,
  startLocalRelay,
} from "@/services/acquisition/relay.server";
import { userFacingError } from "@/lib/user-facing-error";

type Device = Awaited<ReturnType<typeof listRelayDevices>>[number];

export function LocalRelayRecovery({ jobId, onQueued }: { jobId: string; onQueued: () => void }) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [pairingToken, setPairingToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deviceToRevoke, setDeviceToRevoke] = useState<Device | null>(null);
  const [revoking, setRevoking] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      setDevices((await listRelayDevices()) as Device[]);
    } catch (cause) {
      setError(userFacingError(cause, "Paired devices could not be loaded."));
    } finally {
      setLoading(false);
    }
  };

  const copyPairingCommand = async () => {
    if (!pairingToken) return;
    try {
      const server =
        typeof window === "undefined" ? "https://vidrial.vercel.app" : window.location.origin;
      await navigator.clipboard.writeText(
        `vidrial-relay pair --server ${server} --token ${pairingToken}`,
      );
      setCopied(true);
      toast.success("Setup command copied.");
      window.setTimeout(() => setCopied(false), 1_500);
    } catch {
      setError("The setup command could not be copied. Copy the pairing code manually.");
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const pair = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await createRelayPairing({ data: { displayName: "This device" } });
      setPairingToken(result.pairingToken);
    } catch (cause) {
      setError(userFacingError(cause, "A pairing token could not be created."));
    } finally {
      setBusy(false);
    }
  };

  const start = async (deviceId: string) => {
    setBusy(true);
    setError(null);
    try {
      await startLocalRelay({ data: { jobId, deviceId } });
      toast.info("Local acquisition queued. Keep the helper open on your device.");
      onQueued();
    } catch (cause) {
      setError(userFacingError(cause, "The local acquisition request could not be queued."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-surface-panel shadow-sm">
      <div className="border-b border-line bg-surface-sunken/60 px-4 py-4 sm:px-5">
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-success/20 bg-success/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.12em] text-success">
          <ShieldCheck aria-hidden className="h-3.5 w-3.5" /> Recommended · Free
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-semibold text-ink">
              <Laptop aria-hidden className="h-4 w-4 text-ember-ink" /> Continue on this device
            </div>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-soft">
              Run the free helper through your own connection. It uploads only this job's authorised
              clip source and keeps working after you leave this page.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Refresh paired devices"
            onClick={() => void refresh()}
            className="self-start text-ink-soft"
          >
            <RefreshCw
              aria-hidden
              className={loading ? "animate-spin motion-reduce:animate-none" : ""}
            />{" "}
            Refresh
          </Button>
        </div>
      </div>

      <div className="px-4 py-4 sm:px-5 sm:py-5">
        {loading ? (
          <div className="flex min-h-11 items-center gap-2 text-sm text-ink-mute" role="status">
            <LoaderCircle aria-hidden className="h-4 w-4 animate-spin motion-reduce:animate-none" />
            Checking paired devices…
          </div>
        ) : devices.filter((device) => device.status === "active").length ? (
          <div className="mt-4 space-y-2">
            {devices
              .filter((device) => device.status === "active")
              .map((device) => (
                <div
                  key={device.id}
                  className="flex flex-col gap-3 rounded-lg border border-line px-3 py-3 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">
                      {device.display_name}
                    </div>
                    <div className="mt-0.5 text-xs text-ink-mute">
                      Helper {device.helper_version} ·{" "}
                      {device.last_seen_at ? "recently online" : "not seen yet"}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy}
                      onClick={() => void start(device.id)}
                    >
                      {busy ? (
                        <LoaderCircle
                          aria-hidden
                          className="animate-spin motion-reduce:animate-none"
                        />
                      ) : (
                        <Laptop aria-hidden />
                      )}
                      Start local recovery
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeviceToRevoke(device)}
                    >
                      Revoke
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <div>
            <Button type="button" disabled={busy} loading={busy} onClick={() => void pair()}>
              Pair a device
            </Button>
            <p className="mt-2 text-xs leading-5 text-ink-mute">
              One-time setup. The pairing code expires automatically after 10 minutes.
            </p>
          </div>
        )}

        {pairingToken ? (
          <div className="mt-4 min-w-0 rounded-xl border border-ember/20 bg-ember/5 p-3 sm:p-4">
            <p className="text-xs font-semibold text-ink">Pairing code · expires in 10 minutes</p>
            <div className="mt-2 flex min-w-0 flex-col gap-2 sm:flex-row">
              <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-line bg-surface-panel px-3 py-2.5 text-xs text-ink">
                {pairingToken}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void copyPairingCommand()}
                aria-live="polite"
              >
                {copied ? <Check aria-hidden /> : <Copy aria-hidden />}{" "}
                {copied ? "Copied" : "Copy setup command"}
              </Button>
            </div>
            <ol className="mt-3 grid gap-1.5 text-xs leading-5 text-ink-soft">
              <li>
                <span className="font-semibold text-ink">1.</span> Run the copied command in the
                helper terminal.
              </li>
              <li>
                <span className="font-semibold text-ink">2.</span> Run{" "}
                <code>vidrial-relay run</code>, then refresh paired devices.
              </li>
            </ol>
          </div>
        ) : null}

        <details className="group mt-4 rounded-xl border border-line bg-surface-sunken/50 text-xs text-ink-soft">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 font-medium text-ink [&::-webkit-details-marker]:hidden">
            Privacy and source limits
            <ChevronDown
              aria-hidden
              className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
            />
          </summary>
          <p className="border-t border-line px-3 py-3 leading-5">
            Cookies are never uploaded to Vidrial. The helper is cookie-free by default. Optional
            local cookie mode uses full account-session credentials and can cause account
            restrictions. Private, paid, DRM, age- and region-restricted media remain unsupported.
          </p>
        </details>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>
      <ConfirmationDialog
        open={Boolean(deviceToRevoke)}
        onOpenChange={(open) => {
          if (!open) setDeviceToRevoke(null);
        }}
        destructive
        busy={revoking}
        title={`Revoke ${deviceToRevoke?.display_name ?? "this device"}?`}
        description="This helper will stop receiving new recovery requests. You can pair it again later."
        confirmLabel="Revoke device"
        onConfirm={async () => {
          if (!deviceToRevoke) return;
          setRevoking(true);
          try {
            await revokeRelayDevice({ data: { deviceId: deviceToRevoke.id } });
            setDeviceToRevoke(null);
            toast.success("Relay device revoked.");
            await refresh();
          } catch (cause) {
            setError(userFacingError(cause, "The relay device could not be revoked."));
          } finally {
            setRevoking(false);
          }
        }}
      />
    </div>
  );
}
