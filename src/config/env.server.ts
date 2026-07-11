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
  TURNSTILE_SECRET_KEY: z.string().min(10).optional(),
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
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
  });
}
