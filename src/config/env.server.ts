import { z } from "zod";

const serverEnvSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  YOUTUBE_API_KEY: z.string().min(10).optional(),
  GOOGLE_CLIENT_ID: z.string().min(10).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(10).optional(),
  GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY: z.string().min(32).optional(),
  YOUTUBE_WEBHOOK_SECRET: z.string().min(32).optional(),
  TURNSTILE_SECRET_KEY: z.string().min(10).optional(),
  VITE_TURNSTILE_SITE_KEY: z.string().min(10).optional(),
  VIDEO_WORKER_URL: z.string().url().optional(),
  WORKER_WAKE_SECRET: z.string().min(20).optional(),
  OPENROUTER_API_KEY: z.string().min(10).optional(),
  OPENROUTER_CLIP_MODEL: z.string().min(3).optional(),
});

export function getServerEnv() {
  return serverEnvSchema.parse({
    SUPABASE_URL: process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    PUBLIC_APP_URL: process.env.PUBLIC_APP_URL,
    YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY: process.env.GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY,
    YOUTUBE_WEBHOOK_SECRET: process.env.YOUTUBE_WEBHOOK_SECRET,
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
    VITE_TURNSTILE_SITE_KEY: process.env.VITE_TURNSTILE_SITE_KEY,
    VIDEO_WORKER_URL: process.env.VIDEO_WORKER_URL,
    WORKER_WAKE_SECRET: process.env.WORKER_WAKE_SECRET,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    OPENROUTER_CLIP_MODEL: process.env.OPENROUTER_CLIP_MODEL,
  });
}
