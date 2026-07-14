import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Check, CreditCard, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppPageHeader } from "@/components/app/layout";
import { StatusDot } from "@/components/primitives/status-dot";
import { Button } from "@/components/ui/button";
import { userFacingError } from "@/lib/user-facing-error";
import { getBillingOverview, removeBillingInterest, saveBillingInterest } from "@/services/billing/server";

export const Route = createFileRoute("/_authenticated/app/billing")({
  head: () => ({ meta: [{ title: "Billing — Vidrial" }] }),
  loader: () => getBillingOverview(),
  component: Billing,
});

function Billing() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const [plan, setPlan] = useState<"creator" | "pro" | "business">((data.interest?.plan_interest as "creator" | "pro" | "business") ?? "creator");
  const [busy, setBusy] = useState(false);

  return (
    <div>
      <AppPageHeader title="Billing" eyebrow="Plan and payments" description="Review your active plan and manage upgrade interest." />
      <div className="grid gap-4 md:grid-cols-[1.05fr_1fr]">
        <section className="rounded-2xl border border-line bg-surface-panel p-6">
          <div className="flex items-center justify-between gap-3">
            <div><div className="text-xs uppercase tracking-wider text-ink-mute">Current plan</div><h2 className="mt-1 font-display text-2xl capitalize text-ink">{data.plan}</h2></div>
            <StatusDot variant="success">Active</StatusDot>
          </div>
          <div className="mt-5 grid gap-2 text-sm text-ink-soft">
            <span className="flex items-center gap-2"><Check className="h-4 w-4 text-success" />Private projects and media</span>
            <span className="flex items-center gap-2"><Check className="h-4 w-4 text-success" />AI clipping and editable captions</span>
            <span className="flex items-center gap-2"><Check className="h-4 w-4 text-success" />Usage and export history</span>
          </div>
          <Button asChild variant="outline" className="mt-5"><Link to="/app/usage">View plan usage</Link></Button>
        </section>

        <section className="rounded-2xl border border-line bg-surface-panel p-6">
          <div className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-ember" /><h2 className="font-display text-lg text-ink">Plan upgrades</h2></div>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">Tell us which plan fits your workflow. Your interest is saved to your account and we will contact {data.email} when that upgrade is available.</p>
          <label className="mt-4 grid gap-1.5 text-sm text-ink">Plan
            <select value={plan} onChange={(event) => setPlan(event.target.value as typeof plan)} className="min-h-11 rounded-md border border-line bg-surface-page px-3 outline-none focus-visible:ring-2 focus-visible:ring-ember"><option value="creator">Creator</option><option value="pro">Pro</option><option value="business">Business</option></select>
          </label>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button loading={busy} loadingText="Saving…" onClick={async () => { setBusy(true); try { await saveBillingInterest({ data: { plan } }); toast.success("Upgrade interest saved."); await router.invalidate(); } catch (cause) { toast.error(userFacingError(cause, "Upgrade interest could not be saved.")); } finally { setBusy(false); } }}>{data.interest ? "Update interest" : "Notify me"}</Button>
            {data.interest ? <Button variant="ghost" disabled={busy} onClick={async () => { setBusy(true); try { await removeBillingInterest({ data: { confirmation: "REMOVE" } }); toast.success("Upgrade interest removed."); await router.invalidate(); } catch (cause) { toast.error(userFacingError(cause, "Upgrade interest could not be removed.")); } finally { setBusy(false); } }}><Trash2 />Remove</Button> : null}
          </div>
          {data.interest ? <p className="mt-3 text-xs text-ink-mute">Saved interest: <span className="capitalize">{data.interest.plan_interest}</span> · {data.interest.status}</p> : null}
        </section>
      </div>
    </div>
  );
}
