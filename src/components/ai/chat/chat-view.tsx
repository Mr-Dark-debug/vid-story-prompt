import { Link } from "@tanstack/react-router";
import { Paperclip, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { userFacingError } from "@/lib/user-facing-error";
import {
  updateChatThread,
  type ChatMessageDto,
  type ChatThreadSummary,
} from "@/services/ai/threads";
import type { AiModelGroup } from "@/services/ai/server";
import { findPricing, modelKey } from "../model-catalog";
import { ModelPicker } from "../model-picker";
import { modelSwitchMarkers } from "./chat-state";
import { Composer } from "./composer";
import { MessageItem } from "./message-item";
import { takePendingPrompt } from "./pending-prompt";
import { SUGGESTED_PROMPTS } from "./suggestions";
import { useChatStream } from "./use-chat-stream";

export type AttachableJob = { id: string; title: string; createdAt: string; status: string };

export function AttachMenu({
  jobs,
  value,
  onChange,
  disabled,
}: {
  jobs: AttachableJob[];
  value: string | null;
  onChange: (jobId: string | null) => void;
  disabled?: boolean;
}) {
  const selected = jobs.find((job) => job.id === value);
  return (
    <div className="flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            className="h-9 min-h-9 gap-1.5 px-2 text-xs"
          >
            <Paperclip aria-hidden />
            {selected ? (
              <span className="max-w-[10rem] truncate">{selected.title}</span>
            ) : (
              "Attach clip job"
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-72 w-72 overflow-y-auto">
          <DropdownMenuLabel className="text-xs font-normal text-ink-mute">
            The job&rsquo;s clip titles, hooks and transcript are sent to your model as reference
            data.
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {jobs.length === 0 ? (
            <div className="px-3 py-4 text-sm text-ink-mute">No clip jobs yet.</div>
          ) : (
            jobs.map((job) => (
              <DropdownMenuItem key={job.id} onSelect={() => onChange(job.id)}>
                <span className="truncate">{job.title}</span>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {selected ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9"
          aria-label="Remove attached clip job"
          disabled={disabled}
          onClick={() => onChange(null)}
        >
          <X aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}

export function SuggestionGrid({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-2 sm:grid-cols-2">
      {SUGGESTED_PROMPTS.map((suggestion) => (
        <button
          key={suggestion.title}
          type="button"
          onClick={() => onPick(suggestion.prompt)}
          className="min-h-16 rounded-xl border border-line bg-surface-panel p-3 text-left transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember"
        >
          <span className="block text-sm font-medium text-ink">{suggestion.title}</span>
          <span className="mt-0.5 block text-xs text-ink-mute">{suggestion.hint}</span>
        </button>
      ))}
    </div>
  );
}

export function ChatView({
  thread,
  messages: serverMessages,
  groups,
  jobs,
  onChanged,
}: {
  thread: ChatThreadSummary;
  messages: ChatMessageDto[];
  groups: AiModelGroup[];
  jobs: AttachableJob[];
  onChanged: () => void;
}) {
  const { messages, streaming, send, edit, regenerate, stop } = useChatStream({
    threadId: thread.id,
    serverMessages,
    providerId: thread.providerId,
    modelId: thread.modelId,
    onSettled: onChanged,
  });
  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const [prefill, setPrefill] = useState<{ id: number; text: string } | null>(null);
  const markers = useMemo(() => modelSwitchMarkers(messages), [messages]);
  const hasModel = Boolean(thread.credentialId && thread.modelId);
  const selectedKey = hasModel ? modelKey(thread.credentialId!, thread.modelId!) : null;

  // A brand-new chat sends the message typed on the "new chat" screen exactly once.
  useEffect(() => {
    const prompt = takePendingPrompt(thread.id);
    if (prompt) void send(prompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per thread
  }, [thread.id]);

  useEffect(() => {
    const element = scroller.current;
    if (element && stickToBottom.current) element.scrollTop = element.scrollHeight;
  }, [messages]);

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const liveStatus = streaming
    ? ""
    : lastAssistant?.status === "complete"
      ? "Reply complete."
      : lastAssistant?.status === "cancelled"
        ? "Reply stopped."
        : "";

  async function changeModel(next: { credentialId: string; modelId: string } | null) {
    if (!next) return;
    try {
      await updateChatThread({ data: { threadId: thread.id, model: next } });
      onChanged();
    } catch (cause) {
      toast.error(userFacingError(cause, "The model could not be changed."));
    }
  }

  async function changeJob(clipJobId: string | null) {
    try {
      await updateChatThread({ data: { threadId: thread.id, clipJobId } });
      onChanged();
    } catch (cause) {
      toast.error(userFacingError(cause, "The clip job could not be attached."));
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scroller}
        onScroll={(event) => {
          const el = event.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 96;
        }}
        role="log"
        aria-label="Conversation"
        aria-live="off"
        className="min-h-0 flex-1 overflow-y-auto px-1 py-4 sm:px-2"
      >
        <div className="mx-auto grid max-w-3xl gap-6">
          {messages.length === 0 ? (
            <div className="grid gap-6 py-10 text-center">
              <div>
                <h2 className="font-display text-2xl text-ink">What are you working on?</h2>
                <p className="mt-1 text-sm text-ink-soft">
                  Ask about titles, hooks, captions or how to cut a clip.
                </p>
              </div>
              <SuggestionGrid onPick={(text) => setPrefill({ id: Date.now(), text })} />
            </div>
          ) : (
            messages.map((message) => (
              <MessageItem
                key={message.id}
                message={message}
                showModelSwitch={markers.has(message.id)}
                busy={streaming}
                pricing={findPricing(groups, message.providerId, message.modelId)}
                onRegenerate={(target) => void regenerate(target)}
                onEdit={(target, content) => void edit(target, content)}
              />
            ))
          )}
        </div>
      </div>
      <p className="sr-only" role="status">
        {liveStatus}
      </p>

      <div className="mx-auto w-full max-w-3xl pt-2">
        {!hasModel ? (
          <p className="mb-2 rounded-lg border border-line bg-surface-sunken p-3 text-sm text-ink-soft">
            This chat has no usable model. Choose one below
            {groups.length === 0 ? (
              <>
                {" "}
                or{" "}
                <Link to="/app/settings/ai-providers" className="font-medium text-ink underline">
                  connect a provider key
                </Link>
              </>
            ) : null}
            .
          </p>
        ) : null}
        <Composer
          streaming={streaming}
          disabled={!hasModel}
          disabledReason="Choose a model to start chatting."
          onSend={(content) => send(content)}
          onStop={() => void stop()}
          prefill={prefill}
          toolbar={
            <>
              <ModelPicker
                groups={groups}
                value={selectedKey}
                ariaLabel="Model for this chat"
                placeholder="Choose a model"
                disabled={streaming}
                className="h-9 min-h-9 w-auto max-w-[15rem] px-3 text-xs"
                onChange={(model) =>
                  void changeModel(
                    model ? { credentialId: model.credentialId, modelId: model.modelId } : null,
                  )
                }
              />
              <AttachMenu
                jobs={jobs}
                value={thread.clipJobId}
                onChange={(id) => void changeJob(id)}
                disabled={streaming}
              />
            </>
          }
        />
      </div>
    </div>
  );
}
