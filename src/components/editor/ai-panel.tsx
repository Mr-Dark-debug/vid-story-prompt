import { Check, Sparkles, Wand2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { parseModelKey } from "@/components/ai/model-catalog";
import { ModelPicker } from "@/components/ai/model-picker";
import { StatusDot } from "@/components/primitives/status-dot";
import { Button } from "@/components/ui/button";
import { useTimeline } from "@/domain/timeline/store";
import type { Plan, PlanOp } from "@/domain/timeline/types";
import { userFacingError } from "@/lib/user-facing-error";
import { listAiModels, type AiModelGroup } from "@/services/ai/server";
import { planProjectEdit } from "@/services/projects/server";

type PlanOpWithStatus = PlanOp & { status: "pending" | "accepted" | "rejected" };

const suggestions = [
  "Build a concise 90-second first cut from complete moments.",
  "Create a 30-second vertical cut with a clear beginning and ending.",
  "Select the strongest explanatory moments and arrange them in order.",
  "Build a short product story with the clearest final call to action.",
];

export function AIPanel({
  projectId,
  requireReview = true,
}: {
  projectId: string;
  requireReview?: boolean;
}) {
  const [prompt, setPrompt] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const applyOps = useTimeline((state) => state.applyOps);
  // Optional: a user's own models. Without them the panel behaves exactly as before.
  const [groups, setGroups] = useState<AiModelGroup[]>([]);
  const [modelKey, setModelKey] = useState<string | null>(null);
  const [usedModel, setUsedModel] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void listAiModels()
      .then((result) => active && setGroups(result))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const submit = async (suggested?: string) => {
    const request = (suggested ?? prompt).trim();
    if (!request || loading) return;
    setLoading(true);
    setError(null);
    setMessages((current) => [...current, { role: "user", text: request }]);
    setPrompt("");
    try {
      const chosen = modelKey ? parseModelKey(modelKey) : null;
      const result = await planProjectEdit({
        data: { projectId, prompt: request, ...(chosen ? { model: chosen } : {}) },
      });
      setUsedModel(
        result.model.source === "user_key"
          ? `Planned with your key (${result.model.modelId})`
          : "Planned with Vidrial's built-in model",
      );
      const next: Plan = {
        id: result.id,
        prompt: result.prompt,
        createdAt: result.createdAt,
        summary: result.summary,
        estimatedMinutes: result.estimatedMinutes,
        ops: result.operations,
      };
      if (requireReview) setPlan(next);
      else {
        applyOps(next.ops);
        toast.success("AI timeline plan applied. Save a version when you are ready.");
      }
      setMessages((current) => [
        ...current,
        {
          role: "ai",
          text: requireReview
            ? `I prepared ${next.ops.length} reviewable timeline ${next.ops.length === 1 ? "change" : "changes"}. Nothing is applied until you approve it.`
            : `Applied ${next.ops.length} timeline ${next.ops.length === 1 ? "change" : "changes"}. Save a version when you are ready.`,
        },
      ]);
    } catch (cause) {
      const message = userFacingError(cause, "The AI editor could not create a plan. Try again.");
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id: string, status: "accepted" | "rejected") => {
    setPlan((current) =>
      current
        ? {
            ...current,
            ops: current.ops.map((operation) =>
              operation.id === id ? ({ ...operation, status } as PlanOpWithStatus) : operation,
            ),
          }
        : current,
    );
  };

  const applyAccepted = () => {
    if (!plan) return;
    const accepted = plan.ops.filter((operation) => operation.status === "accepted");
    if (!accepted.length) {
      setError("Accept at least one timeline change before applying the plan.");
      return;
    }
    applyOps(accepted);
    setMessages((current) => [
      ...current,
      {
        role: "ai",
        text: `Applied ${accepted.length} approved timeline ${accepted.length === 1 ? "change" : "changes"}. Save a version when you are ready.`,
      },
    ]);
    setPlan(null);
    toast.success("Approved timeline changes applied.");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-line px-4 py-3">
        <div className="flex items-center gap-2 font-display text-sm text-ink">
          <Sparkles className="h-4 w-4 text-ember" /> AI editor
        </div>
        <p className="mt-1 text-[11px] text-ink-mute">
          Request an edit, review every proposed change, then save a version.
        </p>
      </div>
      {groups.some((group) => group.status === "active") ? (
        <div className="border-b border-line px-4 py-2">
          <ModelPicker
            groups={groups}
            value={modelKey}
            ariaLabel="AI model for this edit"
            none={{ label: "Default model" }}
            className="h-9 min-h-9 px-3 text-xs"
            disabled={loading}
            onChange={(model) => setModelKey(model ? model.key : null)}
          />
          <p className="mt-1 text-[11px] text-ink-mute">
            {modelKey
              ? "Your request, asset names and transcript text are sent to this provider using your key."
              : "Uses your editor default, otherwise Vidrial's built-in model."}
          </p>
        </div>
      ) : null}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3" aria-live="polite">
        {messages.length === 0 ? (
          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-wider text-ink-mute">Try</div>
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                disabled={loading}
                onClick={() => void submit(suggestion)}
                className="block min-h-11 w-full rounded-md border border-line bg-surface-page px-3 py-2 text-left text-[12.5px] text-ink-soft transition-colors hover:border-ember hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember disabled:opacity-50"
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={
              message.role === "user"
                ? "ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-ink px-3 py-2 text-[13px] text-surface-page"
                : "max-w-[90%] rounded-2xl rounded-tl-sm bg-surface-sunken px-3 py-2 text-[13px] text-ink"
            }
          >
            {message.text}
          </div>
        ))}
        {loading ? (
          <div
            aria-busy="true"
            className="max-w-[90%] rounded-2xl bg-surface-sunken px-3 py-3 text-xs text-ink-soft"
          >
            Creating a reviewable edit plan…
          </div>
        ) : null}
        {usedModel && !loading ? <p className="text-[11px] text-ink-mute">{usedModel}</p> : null}
        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-danger/25 bg-danger/5 px-3 py-2 text-xs text-danger"
          >
            {error}
          </p>
        ) : null}
        {plan ? (
          <div className="rounded-xl border border-line bg-surface-page p-3">
            <div className="mb-2 flex items-center justify-between gap-2 text-[11px] text-ink-mute">
              <span>{plan.summary}</span>
              <StatusDot variant="info">AI plan</StatusDot>
            </div>
            <ul className="space-y-1.5">
              {plan.ops.map((operation) => (
                <li
                  key={operation.id}
                  className="flex min-h-11 items-center justify-between gap-2 rounded-md border border-line bg-surface-panel px-2 py-1.5 text-[12px]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-ink">{operation.note ?? operation.type}</div>
                    <div className="text-[10px] uppercase tracking-wider text-ink-mute">
                      {operation.type}
                    </div>
                  </div>
                  {operation.status === "pending" ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => toggle(operation.id, "rejected")}
                        aria-label="Reject change"
                      >
                        <X />
                      </Button>
                      <Button
                        size="icon"
                        onClick={() => toggle(operation.id, "accepted")}
                        aria-label="Accept change"
                      >
                        <Check />
                      </Button>
                    </div>
                  ) : (
                    <StatusDot variant={operation.status === "accepted" ? "success" : "muted"}>
                      {operation.status}
                    </StatusDot>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <Button variant="outline" onClick={() => setPlan(null)}>
                Dismiss plan
              </Button>
              <Button onClick={applyAccepted}>
                <Wand2 />
                Apply accepted
              </Button>
            </div>
          </div>
        ) : null}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className="border-t border-line p-3"
      >
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="ai-edit-prompt">
            Describe an edit
          </label>
          <input
            id="ai-edit-prompt"
            value={prompt}
            disabled={loading}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Describe an edit…"
            className="min-h-11 min-w-0 flex-1 rounded-md border border-line bg-surface-page px-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-ember"
          />
          <Button type="submit" loading={loading} aria-label="Create edit plan">
            Send
          </Button>
        </div>
      </form>
    </div>
  );
}
