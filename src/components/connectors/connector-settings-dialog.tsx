import { useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import type { PublicConnectorDefinition } from "@/domain/connectors/types";
import { ConnectorIcon } from "@/components/connectors/connector-icon";
import { AvailabilityBadge } from "@/components/connectors/availability-badge";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export function ConnectorSettingsDialog({
  connector,
  open,
  onOpenChange,
  children,
  isDirty = false,
  onSave,
  saving = false,
  contentClassName,
  bodyClassName,
}: {
  connector: PublicConnectorDefinition;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  isDirty?: boolean;
  onSave?: () => void | boolean | Promise<void | boolean>;
  saving?: boolean;
  contentClassName?: string;
  bodyClassName?: string;
}) {
  const [confirmClose, setConfirmClose] = useState(false);
  const [savingFromGuard, setSavingFromGuard] = useState(false);

  const requestOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isDirty) {
      setConfirmClose(true);
      return;
    }
    onOpenChange(nextOpen);
  };

  const saveAndClose = async () => {
    if (!onSave) return;
    setSavingFromGuard(true);
    try {
      const saved = await onSave();
      if (saved === false) return;
      setConfirmClose(false);
      onOpenChange(false);
    } finally {
      setSavingFromGuard(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={requestOpenChange}>
        <DialogContent
          className={cn(
            "max-h-[min(92dvh,56rem)] w-[calc(100%-1.5rem)] max-w-3xl grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-[1.75rem] border-line bg-surface-panel p-0 shadow-[0_28px_90px_-34px_rgba(29,29,27,.45)]",
            contentClassName,
          )}
        >
          <header className="sticky top-0 z-10 flex items-start gap-4 border-b border-line bg-surface-panel/95 px-5 py-5 pr-14 backdrop-blur sm:px-7">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-line bg-surface-page text-ink-soft shadow-sm">
              <ConnectorIcon connectorId={connector.id} icon={connector.icon} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="font-display text-xl text-ink">
                  {connector.label}
                </DialogTitle>
                <AvailabilityBadge availability={connector.availability} compact />
              </div>
              <DialogDescription className="mt-1 text-sm leading-6 text-ink-soft">
                {connector.description}
              </DialogDescription>
            </div>
          </header>
          <div className={cn("min-h-0 overflow-y-auto px-5 py-6 sm:px-7", bodyClassName)}>
            {children}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent className="w-[calc(100%-2rem)] max-w-md overflow-hidden rounded-[1.75rem] border-line bg-surface-panel p-0 text-center shadow-[0_28px_90px_-34px_rgba(29,29,27,.45)]">
          <div className="relative px-6 pb-7 pt-12 sm:px-8">
            <div className="pointer-events-none absolute -top-24 left-1/2 h-52 w-72 -translate-x-1/2 rounded-full bg-warning/12 blur-3xl" />
            <div className="relative mx-auto grid h-14 w-14 place-items-center rounded-full border border-line bg-surface-panel shadow-sm">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <AlertDialogTitle className="relative mt-6 font-display text-xl text-ink">
              Save connector changes?
            </AlertDialogTitle>
            <AlertDialogDescription className="relative mx-auto mt-2 max-w-sm text-sm leading-6 text-ink-soft">
              You changed this connector's settings. Save them before closing or discard the draft.
            </AlertDialogDescription>
            <div className="relative mt-8 grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setConfirmClose(false)}
                className="h-11 rounded-full border border-line bg-surface-sunken px-4 text-sm font-semibold text-ink"
              >
                Continue editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmClose(false);
                  onOpenChange(false);
                }}
                className="h-11 rounded-full border border-line px-4 text-sm font-semibold text-ink-soft"
              >
                Discard
              </button>
              <button
                type="button"
                disabled={!onSave || saving || savingFromGuard}
                onClick={() => void saveAndClose()}
                className="h-11 rounded-full bg-ink px-4 text-sm font-semibold text-surface-page disabled:opacity-50"
              >
                {saving || savingFromGuard ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
