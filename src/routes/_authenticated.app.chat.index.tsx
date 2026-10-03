import { createFileRoute, getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AttachMenu, SuggestionGrid } from "@/components/ai/chat/chat-view";
import { Composer } from "@/components/ai/chat/composer";
import { stashPendingPrompt } from "@/components/ai/chat/pending-prompt";
import { flattenGroups, modelKey, parseModelKey } from "@/components/ai/model-catalog";
import { ModelPicker } from "@/components/ai/model-picker";
import { userFacingError } from "@/lib/user-facing-error";
import { createChatThread } from "@/services/ai/threads";

export const Route = createFileRoute("/_authenticated/app/chat/")({
  component: NewChat,
});

const layoutRoute = getRouteApi("/_authenticated/app/chat");

function NewChat() {
  const { models, preferences, jobs } = layoutRoute.useLoaderData();
  const navigate = useNavigate();
  const available = useMemo(() => flattenGroups(models), [models]);
  const preferred = preferences.find((preference) => preference.purpose === "chat");
  const preferredKey = preferred ? modelKey(preferred.credentialId, preferred.modelId) : null;
  const [selected, setSelected] = useState<string | null>(
    preferredKey && available.some((model) => model.key === preferredKey) ? preferredKey : null,
  );
  const [clipJobId, setClipJobId] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<{ id: number; text: string } | null>(null);
  const [starting, setStarting] = useState(false);
  const noKeys = available.length === 0;

  async function start(content: string) {
    const parsed = selected ? parseModelKey(selected) : null;
    if (!parsed) {
      toast.error("Choose a model first.");
      return;
    }
    setStarting(true);
    try {
      const thread = await createChatThread({
        data: { credentialId: parsed.credentialId, modelId: parsed.modelId, clipJobId },
      });
      stashPendingPrompt(thread.id, content);
      await navigate({ to: "/app/chat/$threadId", params: { threadId: thread.id } });
    } catch (cause) {
      toast.error(userFacingError(cause, "The chat could not be started."));
      setStarting(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center gap-8 overflow-y-auto px-1 py-6">
      <div className="text-center">
        <h1 className="font-display text-3xl text-ink">AI chat</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
          Chat with the models behind your own provider keys. Your messages go to the provider you
          pick, using your key.
        </p>
      </div>

      {noKeys ? (
        <div className="mx-auto max-w-md rounded-xl border border-line bg-surface-panel p-5 text-center">
          <p className="text-sm text-ink-soft">
            Connect an Anthropic, OpenAI, Google Gemini or OpenRouter key to start chatting.
          </p>
          <Link
            to="/app/settings/ai-providers"
            className="mt-3 inline-flex min-h-11 items-center rounded-md bg-ink px-4 text-sm font-medium text-surface-page hover:bg-ink/90"
          >
            Connect a provider
          </Link>
        </div>
      ) : (
        <SuggestionGrid onPick={(text) => setPrefill({ id: Date.now(), text })} />
      )}

      <div className="mx-auto w-full max-w-3xl">
        <Composer
          streaming={false}
          disabled={noKeys || starting || !selected}
          disabledReason={noKeys ? "Connect a provider key to start." : "Choose a model to start."}
          onSend={start}
          onStop={() => undefined}
          prefill={prefill}
          autoFocus
          toolbar={
            <>
              <ModelPicker
                groups={models}
                value={selected}
                ariaLabel="Model for this chat"
                placeholder="Choose a model"
                className="h-9 min-h-9 w-auto max-w-[15rem] px-3 text-xs"
                disabled={starting}
                onChange={(model) => setSelected(model ? model.key : null)}
              />
              <AttachMenu
                jobs={jobs}
                value={clipJobId}
                onChange={setClipJobId}
                disabled={starting}
              />
            </>
          }
        />
      </div>
    </div>
  );
}
