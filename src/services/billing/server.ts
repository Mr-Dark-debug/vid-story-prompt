import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentSession } from "@/services/auth/server";

async function requireUser() {
  const session = await getCurrentSession();
  if (!session) throw new Error("Your session expired. Sign in again.");
  return session;
}

export const getBillingOverview = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireUser();
  const { data: interest, error } = await getSupabaseServerClient()
    .from("billing_waitlist")
    .select("id,plan_interest,status,created_at,updated_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw new Error(`Billing details could not be loaded: ${error.message}`);
  return { plan: user.plan, email: user.email, interest };
});

export const saveBillingInterest = createServerFn({ method: "POST" })
  .validator(z.object({ plan: z.enum(["creator", "pro", "business"]) }))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const { error } = await getSupabaseServerClient().from("billing_waitlist").upsert({
      user_id: user.id,
      email: user.email,
      plan_interest: data.plan,
      status: "interested",
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) throw new Error(`Plan interest could not be saved: ${error.message}`);
    return { ok: true };
  });

export const removeBillingInterest = createServerFn({ method: "POST" })
  .validator(z.object({ confirmation: z.literal("REMOVE") }))
  .handler(async () => {
    const user = await requireUser();
    const { error } = await getSupabaseServerClient()
      .from("billing_waitlist")
      .delete()
      .eq("user_id", user.id);
    if (error) throw new Error(`Plan interest could not be removed: ${error.message}`);
    return { ok: true };
  });
