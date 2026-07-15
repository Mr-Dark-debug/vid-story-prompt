import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { AuthField, AuthForm, AuthShell, GoogleAuthButton } from "@/components/auth/auth-shell";
import { authService } from "@/services/auth";
import { userFacingError } from "@/lib/user-facing-error";
import { getCurrentSession } from "@/services/auth/server";

function safeAuthenticatedDestination(value?: string) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/app";
}

export const Route = createFileRoute("/login")({
  validateSearch: z.object({ redirect: z.string().optional(), authError: z.string().optional() }),
  beforeLoad: async ({ search }) => {
    if (await getCurrentSession())
      throw redirect({ href: safeAuthenticatedDestination(search.redirect) });
  },
  head: () => ({
    meta: [{ title: "Log in — Vidrial" }],
    links: [{ rel: "canonical", href: "/login" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { redirect, authError } = Route.useSearch();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startGoogle = async () => {
    setBusy(true);
    setError(null);
    try {
      const { url } = await authService.googleSignIn("login", redirect);
      window.location.assign(url);
    } catch (cause) {
      setError(userFacingError(cause, "Google sign-in could not be started."));
      setBusy(false);
    }
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      await authService.login(String(form.get("email")), String(form.get("password")));
      window.location.assign(redirect?.startsWith("/") ? redirect : "/app");
    } catch (cause) {
      setError(userFacingError(cause, "Sign-in failed. Check your details and retry."));
      setBusy(false);
    }
  };
  return (
    <AuthShell
      eyebrow="Log in"
      title="Welcome back."
      lead="Continue to your private Vidrial workspace."
      footer={
        <>
          New to Vidrial?{" "}
          <Link to="/signup" search={{ redirect }} className="font-medium text-ember-ink">
            Create an account
          </Link>
          .
        </>
      }
    >
      <GoogleAuthButton label="Continue with Google" busy={busy} onClick={startGoogle} />
      {authError && !error && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-danger/25 bg-danger/5 px-3.5 py-3 text-sm text-danger"
        >
          {userFacingError(authError, "The secure sign-in could not be completed.")}
        </div>
      )}
      <AuthForm submitLabel="Log in" busy={busy} error={error} onSubmit={submit}>
        <AuthField label="Email" name="email" type="email" autoComplete="email" />
        <AuthField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          minLength={8}
        />
        <div className="text-right">
          <Link to="/forgot-password" className="text-xs text-ink-soft hover:text-ink">
            Forgot password?
          </Link>
        </div>
      </AuthForm>
    </AuthShell>
  );
}
