import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/config/env";
import type { Database } from "./database.types";

let browserClient: SupabaseClient<Database> | undefined;

export function getSupabaseBrowserClient() {
  browserClient ??= createBrowserClient<Database>(
    publicEnv.VITE_SUPABASE_URL,
    publicEnv.VITE_SUPABASE_ANON_KEY,
  );
  return browserClient;
}
