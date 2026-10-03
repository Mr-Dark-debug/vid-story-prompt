import { getServerEnv } from "@/config/env.server";
import { parseCredentialKeyRing } from "@/domain/ai/credential-crypto";
import { createCredentialService } from "./credential-service.server";
import { createSupabaseCredentialStore } from "./credential-store.server";
import { createModelResolver, createSupabaseResolutionStore } from "./resolve.server";

/** The production wiring of the model resolver: Supabase stores, env key ring, platform fallback. */
export function webModelResolver() {
  return createModelResolver({
    store: createSupabaseResolutionStore(),
    credentials: createCredentialService({
      store: createSupabaseCredentialStore(),
      keyRing: () => parseCredentialKeyRing(getServerEnv()),
    }),
    platform: () => {
      const env = getServerEnv();
      return env.OPENROUTER_API_KEY && env.OPENROUTER_CLIP_MODEL
        ? { apiKey: env.OPENROUTER_API_KEY, modelId: env.OPENROUTER_CLIP_MODEL }
        : null;
    },
  });
}
