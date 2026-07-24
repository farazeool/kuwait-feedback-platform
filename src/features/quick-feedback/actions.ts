"use server";

import { redirect } from "next/navigation";

import { requireOrganizationManagementContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function saveQuickFeedbackConfig(formData: FormData) {
  const context = await requireOrganizationManagementContext();
  if (!context.organization) redirect("/dashboard/surveys?error=denied");

  let input: unknown;
  try {
    input = JSON.parse(String(formData.get("config") ?? ""));
  } catch {
    redirect("/dashboard/surveys?error=invalid_config");
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { quickFeedbackConfigSchema } = await import("./schema") as any;
  const parsed = quickFeedbackConfigSchema.safeParse(input);
  if (!parsed.success) redirect(`/dashboard/surveys?error=invalid_config`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createSupabaseServerClient()) as any;
  const { error } = await supabase.rpc("save_quick_feedback_config", {
    p_survey_id: parsed.data.surveyId,
    p_is_enabled: parsed.data.isEnabled,
    p_rating_style: parsed.data.ratingStyle,
    p_positive_threshold: parsed.data.positiveThreshold,
    p_negative_threshold: parsed.data.negativeThreshold,
    p_follow_up_enabled: parsed.data.followUpEnabled,
    p_show_comment_field: parsed.data.showCommentField,
  });

  if (error) {
    console.error("save_quick_feedback_config RPC failed:", error);
    redirect(`/dashboard/surveys/${parsed.data.surveyId}?error=config_failed`);
  }
  redirect(`/dashboard/surveys/${parsed.data.surveyId}?quick_feedback_configured=1`);
}
