import { AlertTriangle, Copy, Pencil, RefreshCw } from "lucide-react";
import { memo, useState } from "react";
import { toast } from "sonner";
import { ModelLogo } from "@/components/primitives/provider-logo";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { familyFromModel } from "@/domain/ai/families";
import { canRegenerate, statusNotice } from "@/domain/ai/message-state";
import { getAiProvider } from "@/domain/ai/providers";
import type { ModelPricing } from "@/domain/ai/types";
import { estimateCost } from "../model-catalog";
import { copyText } from "@/lib/clipboard";
import { ChatMarkdown } from "./chat-markdown";
import type { UiMessage } from "./chat-state";

export type MessageItemProps = {
  message: UiMessage;
  showModelSwitch: boolean;
  /** Replies and edits are disabled while any reply is streaming. */
  busy: boolean;
  pricing?: ModelPricing;
  onRegenerate: (message: UiMessage) => void;
  onEdit: (message: UiMessage, content: string) => void;
};

function UserMessage({
  message,
  busy,
  onEdit,
}: Pick<MessageItemProps, "message" | "busy" | "onEdit">) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);

  if (editing) {
    return (
      <div className="ml-auto grid w-full max-w-[85%] gap-2">
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          aria-label="Edit your message"
          rows={Math.min(8, Math.max(2, draft.split("\n").length))}
          autoFocus
        />
        <p className="text-xs text-ink-mute">
          Sending an edit removes this message&rsquo;s replies and everything after it.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!draft.trim() || busy}
            onClick={() => {
              setEditing(false);
              onEdit(message, draft);
            }}
          >
            Save and resend
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="group ml-auto flex max-w-[85%] flex-col items-end gap-1">
      <div className="whitespace-pre-wrap break-words rounded-2xl rounded-tr-md bg-surface-sunken px-4 py-2.5 text-[15px] leading-7 text-ink">
        {message.content}
      </div>
      {!message.local ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          className="min-h-8 px-2 text-xs text-ink-mute opacity-100 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
          onClick={() => {
            setDraft(message.content);
            setEditing(true);
          }}
          aria-label="Edit message"
        >
          <Pencil aria-hidden /> Edit
        </Button>
      ) : null}
    </div>
  );
}

function AssistantMessage({
  message,
  showModelSwitch,
  busy,
  pricing,
  onRegenerate,
}: Omit<MessageItemProps, "onEdit">) {
  const streaming = message.status === "streaming" || message.status === "pending";
  const notice = statusNotice(message.status);
  const providerLabel = message.providerId
    ? (getAiProvider(message.providerId)?.label ?? message.providerId)
    : null;
  const cost = estimateCost(pricing, {
    inputTokens: message.usageInputTokens,
    outputTokens: message.usageOutputTokens,
  });

  return (
    <div className="group flex gap-3">
      <div className="mt-1 shrink-0">
        {message.modelId && message.providerId ? (
          <ModelLogo
            family={familyFromModel(message.providerId, message.modelId)}
            provider={message.providerId}
            size={24}
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        {showModelSwitch && message.modelId ? (
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-line bg-surface-sunken px-3 py-1 text-xs text-ink-soft">
            Switched to <span className="font-medium text-ink">{message.modelId}</span>
            {providerLabel ? <span> via {providerLabel}</span> : null}
          </div>
        ) : null}
        {message.content ? (
          <ChatMarkdown>{message.content}</ChatMarkdown>
        ) : streaming ? (
          <p className="text-sm text-ink-mute" aria-live="polite">
            Thinking…
          </p>
        ) : null}
        {streaming && message.content ? (
          <span
            aria-hidden
            className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-ink/60 align-middle"
          />
        ) : null}

        {notice || message.errorMessage ? (
          <p
            role={message.status === "failed" ? "alert" : "status"}
            className="mt-2 flex items-start gap-2 text-sm text-ink-soft"
          >
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
            <span>{message.errorMessage ?? notice}</span>
          </p>
        ) : null}

        {!streaming ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-mute">
            {message.content ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-8 px-2 text-xs"
                onClick={async () =>
                  (await copyText(message.content))
                    ? toast.success("Copied.")
                    : toast.error("Copy is not available in this browser.")
                }
              >
                <Copy aria-hidden /> Copy
              </Button>
            ) : null}
            {canRegenerate(message.role, message.status) && !message.local ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-8 px-2 text-xs"
                disabled={busy}
                onClick={() => onRegenerate(message)}
              >
                <RefreshCw aria-hidden />
                {message.status === "complete" ? "Regenerate" : "Try again"}
              </Button>
            ) : null}
            {message.usageOutputTokens !== null ? (
              <span>
                {message.usageInputTokens?.toLocaleString("en") ?? "—"} in ·{" "}
                {message.usageOutputTokens.toLocaleString("en")} out tokens
                {cost ? ` · ${cost}` : ""}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export const MessageItem = memo(function MessageItem(props: MessageItemProps) {
  return props.message.role === "user" ? (
    <UserMessage message={props.message} busy={props.busy} onEdit={props.onEdit} />
  ) : (
    <AssistantMessage {...props} />
  );
});
