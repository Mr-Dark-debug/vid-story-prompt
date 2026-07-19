import { useEffect, useState } from "react";
import { Check, Copy, Laptop, LoaderCircle, RefreshCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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

  const refresh = async () => {
    setLoading(true);
    try {
      setDevices((await listRelayDevices()) as Device[]);
    } catch (cause) {
      setError(userFacingError(cause, "Paired devices could not be loaded."));
    } finally {
      setLoading(false);
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
    <div className="mt-5 rounded-xl border border-line bg-surface-panel p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-semibold text-ink">
            <Laptop className="h-4 w-4 text-ember-ink" /> Continue on this device
          </div>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-soft">
            The free helper downloads through your own connection and uploads only this job's
            authorised source. It runs asynchronously, so you can leave this page after it starts.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void refresh()}>
          <RefreshCw className={loading ? "animate-spin motion-reduce:animate-none" : ""} /> Refresh
        </Button>
      </div>

      {devices.filter((device) => device.status === "active").length ? (
        <div className="mt-4 space-y-2">
          {devices
            .filter((device) => device.status === "active")
            .map((device) => (
              <div
                key={device.id}
                className="flex flex-col gap-3 rounded-lg border border-line px-3 py-3 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">{device.display_name}</div>
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
                      <LoaderCircle className="animate-spin motion-reduce:animate-none" />
                    ) : (
                      <Laptop />
                    )}
                    Start local recovery
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await revokeRelayDevice({ data: { deviceId: device.id } });
                      await refresh();
                    }}
                  >
                    Revoke
                  </Button>
                </div>
              </div>
            ))}
        </div>
      ) : (
        <div className="mt-4">
          <Button type="button" variant="outline" disabled={busy} onClick={() => void pair()}>
            Pair the free helper
          </Button>
        </div>
      )}

      {pairingToken ? (
        <div className="mt-4 min-w-0 rounded-lg bg-surface-sunken p-3">
          <p className="text-xs font-semibold text-ink">Pairing token · expires in 10 minutes</p>
          <div className="mt-2 flex min-w-0 flex-col gap-2 sm:flex-row">
            <code className="min-w-0 flex-1 overflow-x-auto rounded bg-surface-panel px-3 py-2 text-xs text-ink">
              {pairingToken}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                await navigator.clipboard.writeText(pairingToken);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className="mt-2 break-words text-xs leading-5 text-ink-mute">
            Run:{" "}
            <code>
              vidrial-relay pair --server{" "}
              {typeof window === "undefined"
                ? "https://vidrial.vercel.app"
                : window.location.origin}{" "}
              --token TOKEN
            </code>
            , then
            <code> vidrial-relay run</code>. Refresh this panel when pairing finishes.
          </p>
        </div>
      ) : null}

      <div className="mt-4 flex items-start gap-2 rounded-lg border border-warning/25 bg-warning/5 p-3 text-xs leading-5 text-ink-soft">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <span>
          Cookies are never uploaded to Vidrial. The helper is cookie-free by default. Its optional
          local cookie mode uses full account-session credentials and can cause account
          restrictions; use it only when necessary. Private, paid, DRM, age- and region-restricted
          media remain unsupported.
        </span>
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
