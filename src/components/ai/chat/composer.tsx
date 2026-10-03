import { ArrowUp, Square } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { MAX_MESSAGE_CHARS } from "@/services/ai/limits";

const MAX_ROWS_PX = 192;

export function Composer({
  streaming,
  disabled,
  disabledReason,
  onSend,
  onStop,
  toolbar,
  placeholder = "Message your model…",
  prefill,
  autoFocus,
}: {
  streaming: boolean;
  /** No usable model yet; explains why sending is unavailable. */
  disabled?: boolean;
  disabledReason?: string;
  onSend: (content: string) => void | Promise<void>;
  onStop: () => void;
  toolbar?: ReactNode;
  placeholder?: string;
  /** Text to place in the box (for example a chosen suggestion). Changing it replaces the draft. */
  prefill?: { id: number; text: string } | null;
  autoFocus?: boolean;
}) {
  const id = useId();
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const tooLong = value.length > MAX_MESSAGE_CHARS;
  const canSend = !disabled && !streaming && value.trim().length > 0 && !tooLong;

  useEffect(() => {
    if (prefill) {
      setValue(prefill.text);
      ref.current?.focus();
    }
  }, [prefill]);

  // Grow with the text, up to a cap, then scroll.
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, MAX_ROWS_PX)}px`;
  }, [value]);

  async function submit() {
    if (!canSend) return;
    const content = value.trim();
    setValue("");
    await onSend(content);
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="rounded-2xl border border-line bg-surface-panel p-2 shadow-sm focus-within:ring-2 focus-within:ring-ember"
    >
      <label htmlFor={id} className="sr-only">
        Message
      </label>
      <textarea
        id={id}
        ref={ref}
        value={value}
        rows={1}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          // Enter sends; Shift+Enter inserts a newline; IME composition is left alone.
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            void submit();
          }
        }}
        aria-describedby={`${id}-hint`}
        className="block max-h-48 w-full resize-none bg-transparent px-3 py-2 text-[15px] leading-6 text-ink placeholder:text-ink-mute focus:outline-none"
      />
      <div className="flex flex-wrap items-center gap-2 px-1 pt-1">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{toolbar}</div>
        {tooLong ? (
          <span role="alert" className="text-xs text-danger">
            {(value.length - MAX_MESSAGE_CHARS).toLocaleString("en")} characters over the limit
          </span>
        ) : null}
        {streaming ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onStop}
            aria-label="Stop generating"
          >
            <Square aria-hidden className="fill-current" />
          </Button>
        ) : (
          <Button type="submit" size="icon" disabled={!canSend} aria-label="Send message">
            <ArrowUp aria-hidden />
          </Button>
        )}
      </div>
      <p id={`${id}-hint`} className="px-3 pb-1 pt-1 text-[11px] text-ink-mute">
        {disabled && disabledReason
          ? disabledReason
          : "Enter to send · Shift+Enter for a new line. Replies come from the model you chose; check important facts."}
      </p>
    </form>
  );
}
