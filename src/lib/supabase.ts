import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

let client: SupabaseClient | null = null;

/**
 * Server-only Supabase client using the service role key. Never import this
 * from a "use client" component — it must stay on the server.
 */
export function supabaseAdmin(): SupabaseClient {
  if (client) return client;
  client = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });
  return client;
}

export const RESUME_BUCKET = "resumes";
