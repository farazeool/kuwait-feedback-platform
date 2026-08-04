import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getServerEnv } from "@/lib/env/server";
import type { Database } from "@/types/database";

/**
 * Server-only Supabase client authenticated with the service_role key.
 *
 * This client bypasses RLS and must NEVER be imported into a client component,
 * a browser bundle, or any module that could leak to the frontend.
 *
 * The `server-only` import above causes a build error if this module is
 * accidentally imported into a client bundle.
 *
 * Usage:
 * - Call service-role-only RPCs (e.g. enrollment token exchange)
 * - Only after user authorization has been verified
 * - Never forward the raw service_role response to the client
 */
export function createSupabaseServiceRoleClient() {
  const env = getServerEnv();
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for service-role operations. " +
        "Set it in your environment variables.",
    );
  }
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    },
  );
}
