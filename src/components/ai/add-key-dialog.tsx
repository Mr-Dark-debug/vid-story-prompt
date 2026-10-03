import { ExternalLink, ShieldCheck } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { ProviderLogo } from "@/components/primitives/provider-logo";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { userFacingError } from "@/lib/user-facing-error";

export type KeyDialogProvider = {
  id: string;
  label: string;
  keyHelpUrl: string;
  keyPrefixHint: string;
  availability: "available" | "beta" | "coming_soon";
};

export type AddKeyDialogProps = {
  provider: KeyDialogProvider | null;
  /** Replacing an existing connection keeps its label and skips the disclosure checkbox. */
  mode: "add" | "replace";
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: { label: string; apiKey: string }) => Promise<void>;
};

export function AddKeyDialog({ provider, mode, onOpenChange, onSubmit }: AddKeyDialogProps) {
  const ids = { label: useId(), key: useId(), consent: useId() };
  const [label, setLabel] = useState("Personal");
  const [apiKey, setApiKey] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A key is never kept in state longer than the dialog is open.
  useEffect(() => {
    if (!provider) {
      setApiKey("");
      setError(null);
      setAcknowledged(false);
      setBusy(false);
      setLabel("Personal");
    }
  }, [provider]);

  if (!provider) return null;
  const consentRequired = mode === "add";
  const canSubmit =
    !busy &&
    apiKey.trim().length >= 8 &&
    label.trim().length > 0 &&
    (!consentRequired || acknowledged);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ label: label.trim(), apiKey: apiKey.trim() });
      setApiKey("");
      onOpenChange(false);
    } catch (cause) {
      setError(userFacingError(cause, "The key could not be saved. Try again."));
    } finally {
      setApiKey("");
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !busy && onOpenChange(open)}>
      <DialogContent className="max-w-lg">
        <form onSubmit={submit} className="grid gap-5" autoComplete="off">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <ProviderLogo provider={provider.id} size={28} decorative />
              <DialogTitle>
                {mode === "add" ? `Connect ${provider.label}` : `Replace ${provider.label} key`}
              </DialogTitle>
            </div>
            <DialogDescription>
              Paste an API key from your {provider.label} account.{" "}
              <a
                href={provider.keyHelpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-ink underline underline-offset-2"
              >
                Where do I find it?
                <ExternalLink aria-hidden className="size-3" />
              </a>
            </DialogDescription>
          </DialogHeader>

          {mode === "add" ? (
            <div className="grid gap-1.5">
              <Label htmlFor={ids.label}>Label</Label>
              <Input
                id={ids.label}
                value={label}
                maxLength={60}
                onChange={(event) => setLabel(event.target.value)}
                disabled={busy}
              />
              <p className="text-xs text-ink-mute">
                Helps you tell keys apart, for example “Personal” or “Team”.
              </p>
            </div>
          ) : null}

          <div className="grid gap-1.5">
            <Label htmlFor={ids.key}>API key</Label>
            <Input
              id={ids.key}
              type="password"
              inputMode="text"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-1p-ignore
              data-lpignore="true"
              value={apiKey}
              placeholder={provider.keyPrefixHint ? `${provider.keyPrefixHint}…` : undefined}
              onChange={(event) => setApiKey(event.target.value)}
              disabled={busy}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${ids.key}-error` : undefined}
            />
            <p className="flex items-start gap-1.5 text-xs text-ink-mute">
              <ShieldCheck aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              Encrypted before it is stored and never shown again. Only the last four characters
              remain visible.
            </p>
            {error ? (
              <p id={`${ids.key}-error`} role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
          </div>

          {consentRequired ? (
            <div className="flex items-start gap-3 rounded-lg border border-line bg-surface-sunken p-3">
              <Checkbox
                id={ids.consent}
                checked={acknowledged}
                onCheckedChange={(value) => setAcknowledged(value === true)}
                disabled={busy}
                className="mt-0.5"
              />
              <Label htmlFor={ids.consent} className="text-xs font-normal leading-5 text-ink-soft">
                Prompts, and transcript text from sources you choose to process with this key, will
                be sent to {provider.label} using your key. {provider.label}’s terms and pricing
                apply to that usage.
              </Label>
            </div>
          ) : null}

          {provider.availability === "beta" ? (
            <p className="text-xs text-ink-mute">
              {provider.label} is in beta: Vidrial has not yet exercised it with live keys.
            </p>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit} loading={busy} loadingText="Checking key…">
              {mode === "add" ? "Validate and save" : "Validate and replace"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
