import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AuthField, AuthForm, AuthShell } from "@/components/auth/auth-shell";
import { authService } from "@/services/auth";

export const Route = createFileRoute("/forgot-password")({ component: ForgotPasswordPage });

function ForgotPasswordPage() {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await authService.requestPasswordReset(String(new FormData(event.currentTarget).get("email")));
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Reset request failed. Please retry.");
    } finally { setBusy(false); }
  };
  return <AuthShell eyebrow="Account recovery" title="Reset your password." lead="We’ll send a secure reset link if an account exists." footer={<Link to="/login" className="font-medium text-ember-ink">Return to login</Link>}>{sent ? <div role="status" className="rounded-xl bg-success/5 p-4 text-sm text-ink-soft">Check your inbox for the reset link.</div> : <AuthForm submitLabel="Send reset link" busy={busy} error={error} onSubmit={submit}><AuthField label="Email" name="email" type="email" autoComplete="email" /></AuthForm>}</AuthShell>;
}
