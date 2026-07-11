import { Link } from "@tanstack/react-router";
import type { FormEvent, ReactNode } from "react";
import { Logo } from "@/components/primitives/logo";

export function AuthShell({
  eyebrow,
  title,
  lead,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-surface-page px-5 py-14">
      <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(circle_at_18%_12%,var(--ember-soft),transparent_35%),radial-gradient(circle_at_82%_88%,var(--teal-soft),transparent_32%)]" />
      <div className="relative w-full max-w-md">
        <Link to="/" className="mb-8 flex justify-center" aria-label="Vidrial home">
          <Logo />
        </Link>
        <section className="rounded-3xl border border-line bg-surface-panel p-7 shadow-[0_28px_80px_-44px_rgba(56,39,26,.42)] sm:p-9">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ember-ink">
            {eyebrow}
          </div>
          <h1 className="mt-3 font-display text-3xl text-ink">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">{lead}</p>
          <div className="mt-7">{children}</div>
          {footer && <div className="mt-6 border-t border-line pt-5 text-sm text-ink-soft">{footer}</div>}
        </section>
        <p className="mt-5 text-center text-xs text-ink-mute">
          Private by default · Rights-respecting media workflows
        </p>
      </div>
    </main>
  );
}

export function AuthField({
  label,
  name,
  type = "text",
  autoComplete,
  minLength,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  minLength?: number;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-ink">
      {label}
      <input
        required
        name={name}
        type={type}
        autoComplete={autoComplete}
        minLength={minLength}
        className="h-11 rounded-xl border border-line bg-surface-page px-3.5 text-sm outline-none transition focus:border-ember focus:ring-2 focus:ring-ember/15"
      />
    </label>
  );
}

export function AuthForm({
  children,
  submitLabel,
  busy,
  error,
  onSubmit,
}: {
  children: ReactNode;
  submitLabel: string;
  busy: boolean;
  error: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      {children}
      {error && (
        <div role="alert" className="rounded-xl border border-danger/25 bg-danger/5 px-3.5 py-3 text-sm text-danger">
          {error}
        </div>
      )}
      <button
        disabled={busy}
        className="mt-1 h-11 rounded-xl bg-ink px-4 text-sm font-semibold text-surface-page transition hover:bg-ink/90 disabled:cursor-wait disabled:opacity-60"
      >
        {busy ? "Please wait…" : submitLabel}
      </button>
    </form>
  );
}
