import "server-only";

import { randomUUID } from "node:crypto";

import { createSupabaseAnonymousClient } from "@/lib/supabase/anonymous";
import { publicSurveySchema } from "@/features/public-feedback/schema";
import type { PublicSurvey } from "@/features/public-feedback/schema";

// Fields are now part of PublicSurvey via the updated publicSurveySchema
export type QuickFeedbackSurvey = PublicSurvey;

export async function getPublicQuickFeedbackSurvey(publicId: string): Promise<QuickFeedbackSurvey | null> {
  if (!/^[a-zA-Z0-9-]{24,128}$/.test(publicId)) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseAnonymousClient() as any;
  const { data, error } = await supabase.rpc("get_public_survey", { p_public_slug: publicId });
  if (error) return null;
  const parsed = publicSurveySchema.safeParse(data);
  if (!parsed.success) return null;

  // Quick feedback must be enabled
  const qfEnabled = Boolean(data && typeof data === "object" && "quick_feedback_enabled" in data
    ? (data as Record<string, unknown>).quick_feedback_enabled
    : false);
  if (!qfEnabled) return null;

  const logoPath = parsed.data.organization.branding.logo_path;
  const { data: signed } = logoPath
    ? await supabase.storage.from("organization-branding").createSignedUrl(logoPath, 3600)
    : { data: null };

  const raw = data as Record<string, unknown>;

  return {
    ...parsed.data,
    organization: {
      ...parsed.data.organization,
      branding: { ...parsed.data.organization.branding, logo_url: signed?.signedUrl ?? null },
    },
    quick_feedback_enabled: true,
    quick_feedback_rating_style: ((raw.quick_feedback_rating_style as string) ?? "emoji") as "emoji" | "star" | "numeric",
    quick_feedback_positive_threshold: (raw.quick_feedback_positive_threshold as number) ?? 4,
    quick_feedback_negative_threshold: (raw.quick_feedback_negative_threshold as number) ?? 3,
    quick_feedback_categories: (raw.quick_feedback_categories as Array<{ id: string; label_en: string; label_ar: string }>) ?? [],
    escalation_enabled: Boolean(raw.escalation_enabled),
  };
}

export function createQuickFeedbackSession() {
  return {
    idempotencyKey: randomUUID(),
    startedAt: Date.now(),
  };
}
