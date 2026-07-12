import { z } from "zod";

const publicEnvSchema = z.object({
  VITE_SUPABASE_URL: z.string().url().optional().or(z.literal("")),
  VITE_SUPABASE_ANON_KEY: z.string().min(20).optional().or(z.literal("")),
  VITE_TURNSTILE_SITE_KEY: z.string().min(10).optional(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

declare global {
  interface Window {
    __VIDRIAL_PUBLIC_ENV__?: PublicEnv;
  }
}

function runtimeProcessEnv() {
  return typeof process === "undefined" ? undefined : process.env;
}

export function getPublicEnv(): PublicEnv {
  const browserEnv = typeof window === "undefined" ? undefined : window.__VIDRIAL_PUBLIC_ENV__;
  const processEnv = runtimeProcessEnv();
  return publicEnvSchema.parse({
    VITE_SUPABASE_URL:
      browserEnv?.VITE_SUPABASE_URL ??
      import.meta.env.VITE_SUPABASE_URL ??
      processEnv?.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY:
      browserEnv?.VITE_SUPABASE_ANON_KEY ??
      import.meta.env.VITE_SUPABASE_ANON_KEY ??
      processEnv?.VITE_SUPABASE_ANON_KEY,
    VITE_TURNSTILE_SITE_KEY:
      browserEnv?.VITE_TURNSTILE_SITE_KEY ??
      import.meta.env.VITE_TURNSTILE_SITE_KEY ??
      processEnv?.VITE_TURNSTILE_SITE_KEY,
  });
}

export function publicEnvBootstrapScript() {
  return `window.__VIDRIAL_PUBLIC_ENV__=${JSON.stringify(getPublicEnv()).replaceAll("<", "\\u003c")};`;
}
