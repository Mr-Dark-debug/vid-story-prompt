import { Eye, EyeOff } from "lucide-react";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Logo } from "@/components/primitives/logo";
import { Button } from "@/components/ui/button";

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
    <main
      id="main-content"
      tabIndex={-1}
      className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-surface-page px-5 py-14 outline-none"
    >
      <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(circle_at_18%_12%,var(--ember-soft),transparent_35%),radial-gradient(circle_at_82%_88%,var(--teal-soft),transparent_32%)]" />
      <div className="relative w-full max-w-md">
        <Logo className="mb-8 flex justify-center" />
        <section className="rounded-3xl border border-line bg-surface-panel p-7 shadow-[0_28px_80px_-44px_rgba(56,39,26,.42)] sm:p-9">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ember-ink">
            {eyebrow}
          </div>
          <h1 className="mt-3 font-display text-3xl text-ink">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">{lead}</p>
          <div className="mt-7">{children}</div>
          {footer ? (
            <div className="mt-6 border-t border-line pt-5 text-sm text-ink-soft">{footer}</div>
          ) : null}
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
  const password = type === "password";
  const [visible, setVisible] = useState(false);
  const inputId = useId();
  return (
    <div className="grid gap-1.5 text-sm font-medium text-ink">
      <label htmlFor={inputId}>{label}</label>
      <span className="relative">
        <input
          id={inputId}
          required
          name={name}
          type={password && visible ? "text" : type}
          autoComplete={autoComplete}
          minLength={minLength}
          className="h-11 w-full rounded-xl border border-line bg-surface-page px-3.5 pr-12 text-sm outline-none transition focus:border-ember focus:ring-2 focus:ring-ember/15"
        />
        {password ? (
          <button
            type="button"
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
            onClick={() => setVisible((value) => !value)}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-ink-mute hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember"
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        ) : null}
      </span>
    </div>
  );
}

export function AuthForm({
  children,
  submitLabel,
  busy,
  disabled = false,
  error,
  onSubmit,
}: {
  children: ReactNode;
  submitLabel: string;
  busy: boolean;
  disabled?: boolean;
  error: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      {children}
      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-danger/25 bg-danger/5 px-3.5 py-3 text-sm text-danger"
        >
          {error}
        </div>
      ) : null}
      <Button
        type="submit"
        disabled={disabled || busy}
        loading={busy}
        loadingText="Please wait…"
        className="mt-1 h-11 rounded-xl bg-ink text-surface-page hover:bg-ink/90"
      >
        {submitLabel}
      </Button>
    </form>
  );
}

export function GoogleAuthButton({
  label,
  busy,
  disabled = false,
  onClick,
}: {
  label: string;
  busy: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <>
      <Button
        type="button"
        disabled={disabled || busy}
        variant="outline"
        loading={busy}
        loadingText="Opening Google…"
        onClick={onClick}
        className="h-11 w-full rounded-xl bg-surface-page text-ink hover:border-ink/30 hover:bg-surface-sunken"
      >
        <GoogleMark />
        {label}
      </Button>
      <div className="my-5 flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-mute">
        <span className="h-px flex-1 bg-line" />
        or continue with email
        <span className="h-px flex-1 bg-line" />
      </div>
    </>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5">
      <path
        fill="#4285F4"
        d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.3c1.9-1.8 2.9-4.4 2.9-7.4Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.5c-.9.6-2 1-3.4 1a5.9 5.9 0 0 1-5.5-4.1H3.1v2.6A10 10 0 0 0 12 22Z"
      />
      <path fill="#FBBC05" d="M6.5 14a6 6 0 0 1 0-3.9V7.4H3.1a10 10 0 0 0 0 9.2L6.5 14Z" />
      <path
        fill="#EA4335"
        d="M12 5.9c1.6 0 3 .5 4.2 1.6l3.1-3.1A10 10 0 0 0 3.1 7.4l3.4 2.7A5.9 5.9 0 0 1 12 6Z"
      />
    </svg>
  );
}
