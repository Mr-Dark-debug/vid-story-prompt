import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { AuthField, AuthForm, AuthShell } from "@/components/auth/auth-shell";
import { authService } from "@/services/auth";

export const Route = createFileRoute("/signup")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  head: () => ({ meta: [{ title: "Sign up — Vidrial" }], links: [{ rel: "canonical", href: "/signup" }] }),
  component: SignupPage,
});

function SignupPage() {
  const { redirect } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      if (redirect) sessionStorage.setItem("vidrial.auth.redirect", redirect);
      await authService.signup(String(form.get("email")), String(form.get("password")), String(form.get("displayName")));
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Account creation failed. Please retry.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthShell eyebrow="Start free" title="Create your workspace." lead="Your free plan includes 60 source minutes each month." footer={<>Already have an account? <Link to="/login" search={{ redirect }} className="font-medium text-ember-ink">Log in</Link>.</>}>
      {sent ? (
        <div role="status" className="rounded-2xl border border-success/30 bg-success/5 p-5 text-sm leading-relaxed text-ink-soft">
          Check your inbox to verify your email. You can close this page safely.
        </div>
      ) : (
        <AuthForm submitLabel="Create free account" busy={busy} error={error} onSubmit={submit}>
          <AuthField label="Display name" name="displayName" autoComplete="name" minLength={2} />
          <AuthField label="Email" name="email" type="email" autoComplete="email" />
          <AuthField label="Password" name="password" type="password" autoComplete="new-password" minLength={8} />
        </AuthForm>
      )}
    </AuthShell>
  );
}
