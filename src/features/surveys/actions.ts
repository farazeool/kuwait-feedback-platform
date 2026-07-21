"use server";

import { redirect } from "next/navigation";

import { requireOrganizationManagementContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  surveyDraftSchema,
  surveyPublicationSchema,
  toDatabaseQuestions,
} from "@/features/surveys/schemas";

export async function saveSurveyDraft(formData: FormData) {
  const context = await requireOrganizationManagementContext();
  if (!context.organization) redirect("/dashboard/surveys?error=no_organization");

  let input: unknown;
  try {
    input = JSON.parse(String(formData.get("definition") ?? ""));
  } catch {
    redirect("/dashboard/surveys/new?error=invalid_definition");
  }
  const parsed = surveyDraftSchema.safeParse(input);
  if (!parsed.success) redirect("/dashboard/surveys/new?error=invalid_definition");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("save_survey_draft", {
    p_organization_id: context.organization.id,
    p_survey_id: parsed.data.surveyId as string,
    p_title_en: parsed.data.titleEn,
    p_title_ar: parsed.data.titleAr,
    p_description_en: parsed.data.descriptionEn,
    p_description_ar: parsed.data.descriptionAr,
    p_thank_you_en: parsed.data.thankYouEn,
    p_thank_you_ar: parsed.data.thankYouAr,
    p_default_locale: parsed.data.defaultLocale,
    p_location_ids: parsed.data.locationIds,
    p_questions: toDatabaseQuestions(parsed.data.questions),
    p_survey_type: parsed.data.surveyType,
  });
  if (error || !data) redirect(`/dashboard/surveys/${parsed.data.surveyId ?? "new"}/edit?error=save_failed`);
  redirect(`/dashboard/surveys/${data}?saved=1`);
}

export async function publishSurvey(formData: FormData) {
  await requireOrganizationManagementContext();
  const surveyId = String(formData.get("surveyId") ?? "");
  const editor = await import("@/features/surveys/server").then((module) => module.getSurveyEditor(surveyId));
  if (!surveyPublicationSchema.safeParse(editor.draft).success) {
    redirect(`/dashboard/surveys/${surveyId}/edit?error=publication_invalid`);
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("transition_survey_group", { p_survey_id: surveyId, p_status: "active" });
  if (error) redirect(`/dashboard/surveys/${surveyId}?error=publication_failed`);
  redirect(`/dashboard/surveys/${surveyId}?published=1`);
}

export async function archiveSurvey(formData: FormData) {
  await requireOrganizationManagementContext();
  const surveyId = String(formData.get("surveyId") ?? "");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("transition_survey_group", { p_survey_id: surveyId, p_status: "archived" });
  if (error) redirect(`/dashboard/surveys/${surveyId}?error=archive_failed`);
  redirect(`/dashboard/surveys/${surveyId}?archived=1`);
}

export async function duplicateSurvey(formData: FormData) {
  await requireOrganizationManagementContext();
  const surveyId = String(formData.get("surveyId") ?? "");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("duplicate_survey_group", { p_survey_id: surveyId });
  if (error || !data) redirect(`/dashboard/surveys/${surveyId}?error=duplicate_failed`);
  redirect(`/dashboard/surveys/${data}/edit?duplicated=1`);
}
