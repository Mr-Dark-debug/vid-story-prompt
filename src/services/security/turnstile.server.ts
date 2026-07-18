import { getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { getServerEnv } from "@/config/env.server";

export const turnstileActions = ["signup"] as const;
export type TurnstileAction = (typeof turnstileActions)[number];

const turnstileResponseSchema = z.object({
  action: z.string().optional(),
  hostname: z.string().optional(),
  success: z.boolean(),
  "error-codes": z.array(z.string()).optional().default([]),
});

type TurnstileResult = z.infer<typeof turnstileResponseSchema>;

function isLocalHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export class TurnstileVerificationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "TurnstileVerificationError";
  }
}

export function getTurnstileAllowedHostnames(publicAppUrl: string, configured = "") {
  return new Set([
    new URL(publicAppUrl).hostname.toLowerCase(),
    ...configured
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  ]);
}

function turnstileErrorMessage(code: string) {
  if (code === "timeout-or-duplicate")
    return "The security verification expired or was already used. Complete it again.";
  if (code === "invalid-input-response")
    return "The security verification was invalid. Complete it again.";
  if (code === "missing-input-response")
    return "Complete the security verification before continuing.";
  if (code === "invalid-input-secret" || code === "missing-input-secret")
    return "Security verification is temporarily unavailable. Please retry shortly.";
  return "Security verification could not be completed. Please retry.";
}

export function validateTurnstileResult(
  value: unknown,
  expectedAction: TurnstileAction,
  allowedHostnames: ReadonlySet<string>,
): TurnstileResult {
  const result = turnstileResponseSchema.parse(value);
  if (!result.success) {
    const code = result["error-codes"][0] ?? "verification-failed";
    throw new TurnstileVerificationError(code, turnstileErrorMessage(code));
  }
  if (result.action !== expectedAction)
    throw new TurnstileVerificationError(
      "action-mismatch",
      "The security verification was issued for a different action.",
    );
  const localDevelopment = [...allowedHostnames].some(isLocalHostname);
  const responseHostname = result.hostname?.toLowerCase();
  if (!localDevelopment && (!responseHostname || !allowedHostnames.has(responseHostname)))
    throw new TurnstileVerificationError(
      "hostname-mismatch",
      "The security verification was issued for a different website.",
    );
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

  validateTurnstileResult(
    result,
    action,
    getTurnstileAllowedHostnames(env.PUBLIC_APP_URL, env.TURNSTILE_ALLOWED_HOSTNAMES),
  );
  return { configured: true as const };
}
