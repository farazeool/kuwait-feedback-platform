import "server-only";

import { parseServerEnv } from "./schema";

export function getServerEnv() {
  return parseServerEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUBMISSION_FINGERPRINT_SECRET: process.env.SUBMISSION_FINGERPRINT_SECRET,
    APP_TIME_ZONE: process.env.APP_TIME_ZONE,
  });
}
