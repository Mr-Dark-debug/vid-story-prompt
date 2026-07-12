import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { AuthField, AuthForm, AuthShell, GoogleAuthButton } from "@/components/auth/auth-shell";
import { authService } from "@/services/auth";

export const Route = createFileRoute("/signup")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  head: () => ({
    meta: [{ title: "Sign up — Vidrial" }],
    links: [{ rel: "canonical", href: "/signup" }],
  }),
  component: SignupPage,
});

function SignupPage() {
  const { redirect } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startGoogle = async () => {
    setBusy(true);
    setError(null);
    try {
      const { url } = await authService.googleSignIn(redirect);
      window.location.assign(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Google sign-up could not be started.");
      setBusy(false);
    }
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      if (redirect) sessionStorage.setItem("vidrial.auth.redirect", redirect);
      const result = await authService.signup(
        String(form.get("email")),
        String(form.get("password")),
        String(form.get("displayName")),
        redirect,
      );
      if (result.requiresEmailConfirmation) setSent(true);
      else
        window.location.assign(
          redirect?.startsWith("/") && !redirect.startsWith("//") ? redirect : "/app",
        );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Account creation failed. Please retry.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthShell
      eyebrow="Start free"
      title="Create your workspace."
      lead="Your free plan includes 60 source minutes each month."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" search={{ redirect }} className="font-medium text-ember-ink">
            Log in
          </Link>
          .
        </>
      }
    >
      {sent ? (
        <div
          role="status"
          className="rounded-2xl border border-success/30 bg-success/5 p-5 text-sm leading-relaxed text-ink-soft"
        >
          Check your inbox to verify your email. You can close this page safely.
        </div>
      ) : (
        <>
          <GoogleAuthButton label="Sign up with Google" busy={busy} onClick={startGoogle} />
          <AuthForm submitLabel="Create free account" busy={busy} error={error} onSubmit={submit}>
            <AuthField label="Display name" name="displayName" autoComplete="name" minLength={2} />
            <AuthField label="Email" name="email" type="email" autoComplete="email" />
            <AuthField
              label="Password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
            />
          </AuthForm>
        </>
      )}
    </AuthShell>
  );
}
