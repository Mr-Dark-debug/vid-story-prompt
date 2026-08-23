import { z } from "zod";

const publicEnvSchema = z.object({
  VITE_SUPABASE_URL: z.string().url().optional().or(z.literal("")),
  VITE_SUPABASE_ANON_KEY: z.string().min(20).optional().or(z.literal("")),
  VITE_TURNSTILE_SITE_KEY: z.string().min(10).optional(),
  VITE_GOOGLE_SITE_VERIFICATION: z.string().min(5).optional().or(z.literal("")),
  VITE_BING_SITE_VERIFICATION: z.string().min(5).optional().or(z.literal("")),
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
    VITE_GOOGLE_SITE_VERIFICATION:
      browserEnv?.VITE_GOOGLE_SITE_VERIFICATION ??
      import.meta.env.VITE_GOOGLE_SITE_VERIFICATION ??
      processEnv?.VITE_GOOGLE_SITE_VERIFICATION ??
      "3X4sNiR4A5uIQ1uzPN-jeIqr2Snd7fZiAwYYv6J2dt8",
    VITE_BING_SITE_VERIFICATION:
      browserEnv?.VITE_BING_SITE_VERIFICATION ??
      import.meta.env.VITE_BING_SITE_VERIFICATION ??
      processEnv?.VITE_BING_SITE_VERIFICATION,
  });
}

export function publicEnvBootstrapScript() {
  return `window.__VIDRIAL_PUBLIC_ENV__=${JSON.stringify(getPublicEnv()).replaceAll("<", "\\u003c")};`;
}
