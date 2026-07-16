import { Check, Eye, EyeOff, ShieldCheck, Sparkles } from "lucide-react";
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
      className="min-h-dvh bg-surface-page outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ember lg:grid lg:grid-cols-[minmax(22rem,.88fr)_minmax(30rem,1.12fr)]"
    >
      <aside className="relative hidden min-h-dvh overflow-hidden bg-ink p-10 text-surface-page lg:flex lg:flex-col xl:p-14">
        <div className="pointer-events-none absolute inset-0 opacity-80 [background-image:radial-gradient(circle_at_15%_15%,rgba(255,111,89,.42),transparent_31%),radial-gradient(circle_at_80%_78%,rgba(71,148,150,.28),transparent_33%)]" />
        <div className="pointer-events-none absolute -bottom-24 -right-28 h-80 w-80 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -bottom-8 -right-14 h-52 w-52 rounded-full border border-white/10" />
        <Logo className="relative" tone="light" />
        <div className="relative my-auto max-w-md py-16">
          <div className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10">
            <Sparkles className="h-5 w-5 text-ember" />
          </div>
          <h2 className="text-balance font-display text-4xl leading-[1.08] tracking-[-0.025em] text-white">
            From source footage to an explainable first cut.
          </h2>
          <p className="mt-5 max-w-sm text-sm leading-6 text-white/65">
            Build editable video work with transparent AI plans, controlled media access, and a
            workflow designed around your rights.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-white/80">
            {[
              "Review AI decisions before applying edits",
              "Keep source media private by default",
              "Move from transcript to export in one workspace",
            ].map((item) => (
              <li className="flex items-center gap-3" key={item}>
                <span className="grid h-5 w-5 place-items-center rounded-full bg-ember/20 text-ember">
                  <Check className="h-3 w-3" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative flex items-center gap-2 text-xs text-white/50">
          <ShieldCheck className="h-4 w-4" />
          Rights-respecting media workflows
        </p>
      </aside>
      <section className="relative flex min-h-dvh items-center overflow-hidden bg-surface-page px-6 py-10 sm:px-10 lg:px-16 lg:py-12 xl:px-24">
        <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:radial-gradient(circle_at_85%_10%,var(--coral-soft),transparent_26%),radial-gradient(circle_at_15%_90%,var(--teal-soft),transparent_24%)]" />
        <div className="relative mx-auto w-full max-w-md">
          <Logo className="mb-10 lg:hidden" />
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ember-ink">
            {eyebrow}
          </div>
          <h1 className="mt-3 text-balance font-display text-3xl tracking-[-0.02em] text-ink sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 text-sm leading-6 text-ink-soft">{lead}</p>
          <div className="mt-8">{children}</div>
          {footer ? (
            <div className="mt-7 border-t border-line pt-5 text-sm text-ink-soft">{footer}</div>
          ) : null}
          <p className="mt-6 flex items-center gap-2 text-xs text-ink-mute lg:hidden">
            <ShieldCheck className="h-4 w-4" />
            Private by default · Rights-respecting workflows
          </p>
        </div>
      </section>
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
