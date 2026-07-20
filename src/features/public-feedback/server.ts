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
  if (!parsed.success) return null;
  const logoPath = parsed.data.organization.branding.logo_path;
  const { data: signed } = logoPath
    ? await supabase.storage.from("organization-branding").createSignedUrl(logoPath, 3600)
    : { data: null };
  return {
    ...parsed.data,
    organization: {
      ...parsed.data.organization,
      branding: { ...parsed.data.organization.branding, logo_url: signed?.signedUrl ?? null },
    },
  };
}

export function createPublicFeedbackSession() {
  return {
    idempotencyKey: randomUUID(),
    startedAt: Date.now(),
  };
}
