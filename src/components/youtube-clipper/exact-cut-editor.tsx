import { useId, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  parseExactCutPaste,
  validateExactCutRanges,
  type ExactCutDraft,
} from "@/domain/clipping/exact-cut";

export type ExactCutEditorRow = ExactCutDraft & { id: string };

export function ExactCutEditor({
  rows,
  onChange,
  sourceSeconds,
  remainingSeconds,
  maximumClips,
}: {
  rows: ExactCutEditorRow[];
  onChange: (rows: ExactCutEditorRow[]) => void;
  sourceSeconds: number;
  remainingSeconds: number;
  maximumClips: number;
}) {
  const id = useId();
  const [paste, setPaste] = useState("");
  const [pasteErrors, setPasteErrors] = useState<string[]>([]);
  const result = validateExactCutRanges(rows, { sourceSeconds, remainingSeconds, maximumClips });
  const update = (index: number, field: keyof ExactCutDraft, value: string) => {
    onChange(rows.map((row, position) => (position === index ? { ...row, [field]: value } : row)));
  };
  const move = (index: number, offset: -1 | 1) => {
    const next = [...rows];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    onChange(next);
  };
  const addPaste = () => {
    const parsed = parseExactCutPaste(paste);
    setPasteErrors(parsed.errors.map((error) => error.message));
    if (parsed.errors.length) return;
    onChange([...rows, ...parsed.rows.map((row) => ({ ...row, id: crypto.randomUUID() }))]);
    setPaste("");
  };
  return (
    <section aria-labelledby={`${id}-title`} className="space-y-5">
      <div>
        <h3 id={`${id}-title`} className="text-lg font-semibold text-ink">
          Your exact cuts
        </h3>
        <p className="mt-1 text-sm leading-6 text-ink-soft">
          Choose the moments yourself. Each range becomes a separate clip, in the order below.
        </p>
      </div>
      <div className="rounded-xl border border-line bg-surface-sunken p-4">
        <label htmlFor={`${id}-paste`} className="text-sm font-semibold text-ink">
          Paste timestamp ranges
        </label>
        <textarea
          id={`${id}-paste`}
          value={paste}
          maxLength={16000}
          onChange={(event) => {
            setPaste(event.target.value);
            setPasteErrors([]);
          }}
          rows={3}
          placeholder={"00:30-00:45\n01:23-02:10"}
          aria-describedby={`${id}-paste-help`}
          className="mt-2 w-full min-w-0 resize-y rounded-lg border border-line bg-surface-panel p-3 font-mono text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <p id={`${id}-paste-help`} className="mt-2 text-xs leading-5 text-ink-soft">
          Use seconds, MM:SS or H:MM:SS. Separate ranges with commas or new lines. Up to{" "}
          {maximumClips} clips on your plan.
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-3"
          disabled={!paste.trim()}
          onClick={addPaste}
        >
          Add pasted ranges
        </Button>
        {pasteErrors.length > 0 && (
          <div role="alert" className="mt-3 text-sm text-danger">
            {pasteErrors.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </div>
        )}
      </div>
      <ol aria-label="Exact Cut ranges" className="space-y-3">
        {rows.map((row, index) => (
          <li key={row.id} className="min-w-0 rounded-xl border border-line bg-surface-panel p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-mute">
                Clip {index + 1}
              </p>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Move clip ${index + 1} up`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Move clip ${index + 1} down`}
                  disabled={index === rows.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove clip ${index + 1}`}
                  onClick={() => onChange(rows.filter((_, position) => position !== index))}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
            </div>
            <div className="grid min-w-0 grid-cols-2 gap-3">
              {(["label", "start", "end"] as const).map((field) => {
                const fieldId = `${id}-${row.id}-${field}`;
                const issue = result.issues.find(
                  (item) => item.row === index && item.field === field,
                );
                return (
                  <div key={field} className={field === "label" ? "col-span-2 min-w-0" : "min-w-0"}>
                    <label htmlFor={fieldId} className="text-xs font-medium text-ink-soft">
                      {field === "label" ? "Label (optional)" : field === "start" ? "Start" : "End"}
                      <span className="sr-only"> for clip {index + 1}</span>
                    </label>
                    <Input
                      id={fieldId}
                      value={row[field]}
                      maxLength={field === "label" ? 120 : 32}
                      autoComplete="off"
                      spellCheck={false}
                      aria-invalid={Boolean(issue)}
                      aria-describedby={issue ? `${fieldId}-error` : undefined}
                      onChange={(event) => update(index, field, event.target.value)}
                      className={`mt-1 min-h-11 ${field === "label" ? "" : "font-mono"}`}
                    />
                    {issue && (
                      <p id={`${fieldId}-error`} className="mt-1 text-xs leading-5 text-danger">
                        {issue.message}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </li>
        ))}
      </ol>
      <Button
        type="button"
        variant="outline"
        disabled={rows.length >= maximumClips}
        onClick={() =>
          onChange([...rows, { id: crypto.randomUUID(), label: "", start: "", end: "" }])
        }
      >
        <Plus aria-hidden />
        Add a range
      </Button>
      <div
        role="status"
        aria-live="polite"
        className="rounded-xl border border-line bg-surface-sunken p-4"
      >
        <p className="text-sm font-semibold text-ink">
          {rows.length} of {maximumClips} clips ·{" "}
          {Number.isFinite(result.billableSeconds) ? result.billableSeconds : "—"} processing
          seconds
        </p>
        <p className="mt-1 text-xs leading-5 text-ink-soft">
          {Number.isFinite(remainingSeconds) ? Math.max(0, remainingSeconds) : "—"} seconds
          remaining. Usage is the sum of your ranges, rounded up once to a whole second.
        </p>
        {result.errors.map((message) => (
          <p key={message} className="mt-2 text-sm text-danger">
            {message}
          </p>
        ))}
        {result.overlaps.length > 0 && (
          <p className="mt-2 text-sm text-warning">
            Some ranges overlap. They will stay separate and each full range counts toward usage.
          </p>
        )}
      </div>
    </section>
  );
}
