import { createFileRoute } from "@tanstack/react-router";
import { Save } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/primitives/section";
import { cn } from "@/lib/utils";
import { getProjectTranscript, saveProjectTranscriptEdits } from "@/services/projects/server";

export const Route = createFileRoute("/_authenticated/app/projects/$projectId/transcript")({
  loader: ({ params }) => getProjectTranscript({ data: { projectId: params.projectId } }),
  component: TranscriptPage,
});
function TranscriptPage() {
  const { words, edits } = Route.useLoaderData();
  const { projectId } = Route.useParams();
  const initial =
    edits &&
    typeof edits === "object" &&
    !Array.isArray(edits) &&
    Array.isArray((edits as { excludedIds?: unknown }).excludedIds)
      ? (edits as { excludedIds: string[] }).excludedIds
      : [];
  const [excluded, setExcluded] = useState<string[]>(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const groups = useMemo(() => {
    const result: Array<{ speaker: string; words: typeof words }> = [];
    for (const word of words) {
      const last = result.at(-1);
      if (!last || last.speaker !== word.speaker_key)
        result.push({ speaker: word.speaker_key || "Speaker", words: [word] });
      else last.words.push(word);
    }
    return result;
  }, [words]);
  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await saveProjectTranscriptEdits({ data: { projectId, excludedIds: excluded } });
      setMessage("Transcript edit decisions saved to the project.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Transcript edits could not be saved.");
    } finally {
      setSaving(false);
    }
  };
  if (words.length === 0)
    return (
      <Callout tone="info" title="Transcript not ready">
        Start a processing job from the Media tab. The transcript will appear here as soon as the
        worker finishes transcription.
      </Callout>
    );
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
      <div className="space-y-3">
        <Callout tone="info" title="Non-destructive text editing">
          Select a word to exclude it from future timeline operations. The original transcript
          remains unchanged.
        </Callout>
        <div className="rounded-2xl border border-line bg-surface-panel p-5 leading-8">
          {groups.map((group, index) => (
            <div key={`${group.speaker}-${index}`} className="mb-5">
              <h2 className="mb-1 text-[11px] uppercase tracking-[.14em] text-ink-mute">
                {group.speaker}
              </h2>
              <p className="flex flex-wrap gap-1">
                {group.words.map((word) => {
                  const removed = excluded.includes(word.id);
                  return (
                    <button
                      key={word.id}
                      type="button"
                      onClick={() =>
                        setExcluded((items) =>
                          removed ? items.filter((id) => id !== word.id) : [...items, word.id],
                        )
                      }
                      aria-pressed={removed}
                      title={`${Number(word.start_seconds).toFixed(1)} seconds`}
                      className={cn(
                        "min-h-10 rounded px-2 text-sm focus-visible:ring-2 focus-visible:ring-ember",
                        removed ? "text-ink-mute line-through" : "text-ink hover:bg-surface-sunken",
                      )}
                    >
                      {word.text}
                    </button>
                  );
                })}
              </p>
            </div>
          ))}
        </div>
      </div>
      <aside className="space-y-3">
        <div className="rounded-xl border border-line bg-surface-panel p-4 text-sm">
          <h2 className="font-display text-ink">Transcript summary</h2>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <dt className="text-ink-soft">Words</dt>
            <dd className="text-right tabular-nums">{words.length}</dd>
            <dt className="text-ink-soft">Excluded</dt>
            <dd className="text-right tabular-nums">{excluded.length}</dd>
            <dt className="text-ink-soft">Speakers</dt>
            <dd className="text-right tabular-nums">
              {new Set(words.map((word) => word.speaker_key)).size}
            </dd>
          </dl>
        </div>
        <Button
          className="w-full"
          onClick={() => void save()}
          loading={saving}
          loadingText="Saving…"
        >
          <Save />
          Save transcript edits
        </Button>
        <p role="status" aria-live="polite" className="text-xs text-ink-soft">
          {message}
        </p>
      </aside>
    </div>
  );
}
