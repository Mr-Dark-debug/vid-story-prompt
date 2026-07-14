import { createFileRoute } from "@tanstack/react-router";
import { Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AppPageHeader } from "@/components/app/layout";
import { Button } from "@/components/ui/button";
import { userFacingError } from "@/lib/user-facing-error";
import { getCurrentSession } from "@/services/auth/server";
import { submitSupportRequest } from "@/services/support/server";

export const Route = createFileRoute("/_authenticated/app/feedback")({
  head: () => ({ meta: [{ title: "Feedback — Vidrial" }] }),
  loader: () => getCurrentSession(),
  component: Feedback,
});

function Feedback() {
  const user = Route.useLoaderData();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSending(true);
    const form = new FormData(event.currentTarget);
    try {
      await submitSupportRequest({ data: { name: user?.name || "Vidrial user", email: user?.email || "", topic: "general", message: String(form.get("message")), website: "" } });
      setSent(true);
      event.currentTarget.reset();
      toast.success("Feedback sent. Thank you.");
    } catch (cause) {
      toast.error(userFacingError(cause, "Feedback could not be sent. Try again."));
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <AppPageHeader title="Feedback" eyebrow="Help shape Vidrial" description="Your feedback is sent securely to the product team and linked to your account for follow-up." />
      <form onSubmit={submit} className="max-w-xl space-y-4 rounded-2xl border border-line bg-surface-panel p-6">
        <label className="grid gap-1.5 text-sm text-ink">What should we improve?
          <textarea name="message" required minLength={8} maxLength={2000} rows={6} className="rounded-md border border-line bg-surface-page p-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-ember" />
        </label>
        {sent ? <p role="status" className="text-sm text-success">Your previous message was sent successfully. You can send another.</p> : null}
        <Button type="submit" loading={sending} loadingText="Sending…"><Send />Send feedback</Button>
      </form>
    </div>
  );
}
