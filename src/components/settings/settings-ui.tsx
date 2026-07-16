import type { ReactNode } from "react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export function SettingsSection({
  title,
  description,
  children,
  tone = "default",
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border bg-surface-panel",
        tone === "danger" ? "border-danger/30" : "border-line",
      )}
    >
      <div
        className={cn(
          "border-b px-5 py-4 sm:px-6",
          tone === "danger" ? "border-danger/20 bg-danger/5" : "border-line",
        )}
      >
        <h2 className="font-display text-lg text-ink">{title}</h2>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-soft">{description}</p>
        ) : null}
      </div>
      <div className="px-5 py-2 sm:px-6">{children}</div>
    </section>
  );
}

export function SettingRow({
  title,
  description,
  children,
  htmlFor,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
}) {
  const Copy = htmlFor ? "label" : "div";
  return (
    <div className="flex min-h-20 flex-col gap-3 border-b border-line py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <Copy {...(htmlFor ? { htmlFor } : {})} className="max-w-xl pr-4">
        <span className="block text-sm font-medium text-ink">{title}</span>
        {description ? (
          <span className="mt-1 block text-xs leading-5 text-ink-mute">{description}</span>
        ) : null}
      </Copy>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingsToggle({
  id,
  title,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <SettingRow title={title} description={description} htmlFor={id}>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </SettingRow>
  );
}

export function SettingsSaveBar({ children, status }: { children: ReactNode; status?: ReactNode }) {
  return (
    <div className="sticky bottom-3 z-10 mt-6 flex min-h-14 items-center justify-between gap-3 py-2">
      <div role="status" aria-live="polite" className="text-sm text-ink-soft">
        {status}
      </div>
      <div className="ml-auto flex flex-wrap justify-end gap-2">{children}</div>
    </div>
  );
}
