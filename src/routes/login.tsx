import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { AuthField, AuthForm, AuthShell } from "@/components/auth/auth-shell";
import { authService } from "@/services/auth";

export const Route = createFileRoute("/login")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  head: () => ({ meta: [{ title: "Log in — Vidrial" }], links: [{ rel: "canonical", href: "/login" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      await authService.login(String(form.get("email")), String(form.get("password")));
      window.location.assign(redirect?.startsWith("/") ? redirect : "/app");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign-in failed. Check your details and retry.");
      setBusy(false);
    }
  };
  return (
    <AuthShell
      eyebrow="Log in"
      title="Welcome back."
      lead="Continue to your private Vidrial workspace."
      footer={<>New to Vidrial? <Link to="/signup" search={{ redirect }} className="font-medium text-ember-ink">Create an account</Link>.</>}
    >
      <AuthForm submitLabel="Log in" busy={busy} error={error} onSubmit={submit}>
        <AuthField label="Email" name="email" type="email" autoComplete="email" />
        <AuthField label="Password" name="password" type="password" autoComplete="current-password" minLength={8} />
        <div className="text-right"><Link to="/forgot-password" className="text-xs text-ink-soft hover:text-ink">Forgot password?</Link></div>
      </AuthForm>
    </AuthShell>
  );
}
