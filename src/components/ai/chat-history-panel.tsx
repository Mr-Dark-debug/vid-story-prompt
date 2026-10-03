import { useState } from "react";
import { toast } from "sonner";
import { SelectField } from "@/components/ui/select-field";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/status-dialog";
import { userFacingError } from "@/lib/user-facing-error";
import { deleteAllChatThreads, setChatRetention } from "@/services/ai/threads";

export const RETENTION_OPTIONS = [
  { value: "keep", label: "Keep until I delete them", days: null },
  { value: "7", label: "7 days after the last message", days: 7 },
  { value: "30", label: "30 days after the last message", days: 30 },
  { value: "90", label: "90 days after the last message", days: 90 },
  { value: "365", label: "1 year after the last message", days: 365 },
] as const;

/** Maps a stored day count to the closest offered option; unknown values stay visible as custom. */
export function retentionValue(days: number | null): string {
  if (days === null) return "keep";
  return RETENTION_OPTIONS.some((option) => option.days === days) ? String(days) : `custom:${days}`;
}

export function ChatHistoryPanel({
  retentionDays,
  onChanged,
}: {
  retentionDays: number | null;
  onChanged: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const current = retentionValue(retentionDays);
  const options = [
    ...RETENTION_OPTIONS.map(({ value, label }) => ({ value, label })),
    ...(current.startsWith("custom:")
      ? [{ value: current, label: `${retentionDays} days after the last message` }]
      : []),
  ];

  return (
    <section
      aria-labelledby="ai-chat-history"
      className="rounded-xl border border-line bg-surface-panel p-5"
    >
      <h3 id="ai-chat-history" className="font-display text-lg text-ink">
        Chat history
      </h3>
      <p className="mt-1 text-sm text-ink-soft">
        Chats are stored so you can return to them. Deleting a chat erases it permanently; nothing
        is kept afterwards.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,20rem)_auto] sm:items-end">
        <SelectField
          label="Automatically delete chats"
          value={current}
          disabled={saving}
          options={options}
          hint="Expired chats are removed by a daily clean-up."
          onValueChange={async (value) => {
            const days = RETENTION_OPTIONS.find((option) => option.value === value)?.days;
            if (days === undefined) return;
            setSaving(true);
            try {
              await setChatRetention({ data: { days } });
              toast.success(
                days === null ? "Chats are kept until you delete them." : "Retention saved.",
              );
              onChanged();
            } catch (cause) {
              toast.error(userFacingError(cause, "The retention setting could not be saved."));
            } finally {
              setSaving(false);
            }
          }}
        />
        <Button type="button" variant="outline" onClick={() => setConfirming(true)}>
          Delete all chats
        </Button>
      </div>
      <ConfirmationDialog
        open={confirming}
        onOpenChange={setConfirming}
        destructive
        busy={deleting}
        title="Delete all your chats permanently?"
        description="Every conversation and message you have stored is erased from Vidrial. This cannot be undone."
        confirmLabel="Delete all chats"
        onConfirm={async () => {
          setDeleting(true);
          try {
            await deleteAllChatThreads();
            toast.success("All chats deleted.");
            onChanged();
          } catch (cause) {
            toast.error(userFacingError(cause, "Your chats could not be deleted."));
          } finally {
            setDeleting(false);
            setConfirming(false);
          }
        }}
      />
    </section>
  );
}
