import { getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { getServerEnv } from "@/config/env.server";

export const turnstileActions = ["signup"] as const;
export type TurnstileAction = (typeof turnstileActions)[number];

const turnstileResponseSchema = z.object({
  action: z.string().optional(),
  hostname: z.string().optional(),
  success: z.boolean(),
});

type TurnstileResult = z.infer<typeof turnstileResponseSchema>;

function isLocalHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function validateTurnstileResult(
  value: unknown,
  expectedAction: TurnstileAction,
  expectedHostname: string,
): TurnstileResult {
  const result = turnstileResponseSchema.parse(value);
  if (!result.success) throw new Error("The security verification expired. Complete it again.");
  if (result.action !== expectedAction)
    throw new Error("The security verification was issued for a different action.");
  if (!isLocalHostname(expectedHostname) && result.hostname !== expectedHostname)
    throw new Error("The security verification was issued for a different website.");
  return result;
}

export async function verifyTurnstile(token: string | undefined, action: TurnstileAction) {
  const env = getServerEnv();
  const secret = env.TURNSTILE_SECRET_KEY;
  const siteKey = env.VITE_TURNSTILE_SITE_KEY;

  if (!secret && !siteKey) return { configured: false as const };
  if (!secret || !siteKey)
    throw new Error("Security verification is temporarily unavailable. Please retry shortly.");
  if (!token) throw new Error("Complete the security verification before continuing.");

  const body = new URLSearchParams({ secret, response: token });
  const requestIp = getRequestIP({ xForwardedFor: true });
  if (requestIp) body.set("remoteip", requestIp);

  let response: Response;
  try {
    response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw new Error("Security verification could not be reached. Please retry.");
  }
  if (!response.ok) throw new Error("Security verification could not be completed. Please retry.");

  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new Error("Security verification returned an invalid response. Please retry.");
  }

  validateTurnstileResult(result, action, new URL(env.PUBLIC_APP_URL).hostname);
  return { configured: true as const };
}
