import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { AuthShell } from "@/components/auth/auth-shell";
import { exchangeAuthCode } from "@/services/auth/server";

export const Route = createFileRoute("/verify-email")({
  validateSearch: z.object({ code: z.string().optional() }),
  head: () => ({ meta: [{ title: "Verify email — Vidrial" }] }),
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const { code } = Route.useSearch();
  const [state, setState] = useState<"checking" | "ready" | "failed">(code ? "checking" : "ready");
  useEffect(() => {
    if (!code) return;
    exchangeAuthCode({ data: { code } })
      .then(() => {
        const redirect = sessionStorage.getItem("vidrial.auth.redirect") || "/app";
        sessionStorage.removeItem("vidrial.auth.redirect");
        window.location.assign(redirect.startsWith("/") ? redirect : "/app");
      })
      .catch(() => setState("failed"));
  }, [code]);
  return <AuthShell eyebrow="Verify email" title={state === "failed" ? "That link could not be verified." : "Check your inbox."} lead={state === "checking" ? "Verifying your secure sign-in link…" : state === "failed" ? "The link may be expired or already used. Return to login and request another." : "Open the verification link we sent to finish creating your workspace."}>{state === "failed" && <a href="/login" className="block rounded-xl bg-ink px-4 py-3 text-center text-sm font-semibold text-surface-page">Return to login</a>}</AuthShell>;
}
