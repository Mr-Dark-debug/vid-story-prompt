import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AuthField, AuthForm, AuthShell } from "@/components/auth/auth-shell";
import { authService } from "@/services/auth";

export const Route = createFileRoute("/reset-password")({ component: ResetPasswordPage });

function ResetPasswordPage() {
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(null);
    try { await authService.resetPassword(String(new FormData(event.currentTarget).get("password"))); setComplete(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Password update failed. Request a new reset link."); }
    finally { setBusy(false); }
  };
  return <AuthShell eyebrow="Account recovery" title="Choose a new password." lead="Use at least eight characters and avoid reused passwords.">{complete ? <a href="/login" className="block rounded-xl bg-ink px-4 py-3 text-center text-sm font-semibold text-surface-page">Continue to login</a> : <AuthForm submitLabel="Update password" busy={busy} error={error} onSubmit={submit}><AuthField label="New password" name="password" type="password" autoComplete="new-password" minLength={8} /></AuthForm>}</AuthShell>;
}
