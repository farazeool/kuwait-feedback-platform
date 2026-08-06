import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getServerEnv } from "@/lib/env/server";
import type { Database } from "@/types/database";
import { createSupabaseServiceRoleClient as createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * Service-role Supabase client aliased here so route handlers that import
 * from `@/lib/supabase/server` can reach the bypass client without pulling
 * the service-role module into a place that might be reused server-side.
 *
 * The underlying `createSupabaseServiceRoleClient` is `server-only` and
 * requires the `SUPABASE_SERVICE_ROLE_KEY` to be configured. It must never
 * leak into a browser bundle.
 */
export const createServiceRoleSupabaseClient = createServiceRoleClient;

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const env = getServerEnv();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components cannot write cookies. Middleware/session refresh
            // will own cookie updates when authentication is implemented.
          }
        },
      },
    },
  );
}
