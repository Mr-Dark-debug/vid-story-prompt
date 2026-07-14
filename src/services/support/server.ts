import { createHash } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase/server";

const attempts = new Map<string, number[]>();
const supportSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(320),
  topic: z.enum(["general", "billing", "partnership", "trust"]),
  message: z.string().trim().min(8).max(2000),
  website: z.string().max(0).optional(),
});

export const submitSupportRequest = createServerFn({ method: "POST" })
  .validator(supportSchema)
  .handler(async ({ data }) => {
    const key = createHash("sha256")
      .update(getRequestIP({ xForwardedFor: true }) ?? "unknown")
      .digest("hex");
    const now = Date.now();
    const recent = (attempts.get(key) ?? []).filter((time) => time > now - 60 * 60_000);
    if (recent.length >= 5)
      throw new Error("Too many messages were sent. Wait an hour, then try again.");
    recent.push(now);
    attempts.set(key, recent);
    const { data: auth } = await getSupabaseServerClient().auth.getUser();
    const { error } = await getSupabaseAdminClient()
      .from("support_requests")
      .insert({
        user_id: auth.user?.id ?? null,
        name: data.name,
        email: data.email,
        topic: data.topic,
        message: data.message,
        status: "new",
      });
    if (error) throw new Error("Your message could not be saved. Email hello@vidrial.app instead.");
    return { ok: true };
  });
