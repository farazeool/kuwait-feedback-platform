import "server-only";

import { randomUUID } from "node:crypto";

import { createSupabaseAnonymousClient } from "@/lib/supabase/anonymous";
import { publicSurveySchema } from "@/features/public-feedback/schema";

export async function getPublicSurvey(publicId: string) {
  if (!/^[a-zA-Z0-9-]{24,128}$/.test(publicId)) return null;
  const supabase = createSupabaseAnonymousClient();
  const { data, error } = await supabase.rpc("get_public_survey", { p_public_slug: publicId });
  if (error) return null;
  const parsed = publicSurveySchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export function createPublicFeedbackSession() {
  return {
    idempotencyKey: randomUUID(),
    startedAt: Date.now(),
  };
}
