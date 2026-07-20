import "server-only";

import { notFound } from "next/navigation";

import { requireAppAccessContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SurveyDraft, SurveyBuilderQuestion } from "@/features/surveys/schemas";

export async function listSurveyGroups(filters: {
  search?: string;
  status?: string;
  location?: string;
}) {
  const context = await requireAppAccessContext();
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("surveys")
    .select("id, survey_group_id, organization_id, location_id, title_en, title_ar, status, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (filters.status && ["draft", "active", "archived"].includes(filters.status)) {
    query = query.eq("status", filters.status as "draft" | "active" | "archived");
  }
  if (filters.location) query = query.eq("location_id", filters.location);
  if (filters.search) {
    const safeSearch = filters.search.replace(/[%(),]/g, " ").trim();
    if (safeSearch) query = query.or(`title_en.ilike.%${safeSearch}%,title_ar.ilike.%${safeSearch}%`);
  }

  const { data: surveys, error } = await query;
  if (error) throw new Error("Unable to load surveys");

  const surveyIds = (surveys ?? []).map((survey) => survey.id);
  const [{ data: locations }, { data: questions }, { data: responses }, { data: organizations }] =
    await Promise.all([
      supabase.from("locations").select("id, name_en, name_ar"),
      surveyIds.length
        ? supabase.from("survey_questions").select("survey_id").in("survey_id", surveyIds)
        : Promise.resolve({ data: [] }),
      surveyIds.length
        ? supabase.from("survey_responses").select("survey_id").in("survey_id", surveyIds)
        : Promise.resolve({ data: [] }),
      supabase.from("organizations").select("id, name_en, name_ar"),
    ]);

  const locationById = new Map((locations ?? []).map((row) => [row.id, row]));
  const organizationById = new Map((organizations ?? []).map((row) => [row.id, row]));
  const questionCounts = countBy((questions ?? []).map((row) => row.survey_id));
  const responseCounts = countBy((responses ?? []).map((row) => row.survey_id));
  const groups = new Map<string, (typeof surveys)[number][] >();
  for (const survey of surveys ?? []) {
    const rows = groups.get(survey.survey_group_id) ?? [];
    rows.push(survey);
    groups.set(survey.survey_group_id, rows);
  }

  return {
    context,
    rows: [...groups.values()].map((members) => {
      const primary = members[0];
      return {
        id: primary.id,
        titleEn: primary.title_en,
        titleAr: primary.title_ar,
        status: primary.status,
        organization: organizationById.get(primary.organization_id) ?? null,
        locations: members.map((member) => locationById.get(member.location_id)).filter(Boolean),
        questionCount: Math.max(...members.map((member) => questionCounts.get(member.id) ?? 0)),
        responseCount: members.reduce((total, member) => total + (responseCounts.get(member.id) ?? 0), 0),
        createdAt: primary.created_at,
        updatedAt: members.reduce(
          (latest, member) => (member.updated_at > latest ? member.updated_at : latest),
          primary.updated_at,
        ),
      };
    }),
  };
}

function countBy(values: string[]) {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return counts;
}

export async function getSurveyEditor(surveyId: string): Promise<{
  draft: SurveyDraft;
  status: "draft" | "active" | "archived";
  publicSlug: string;
  responseCount: number;
}> {
  const supabase = await createSupabaseServerClient();
  const { data: survey } = await supabase.from("surveys").select("*").eq("id", surveyId).maybeSingle();
  if (!survey) notFound();

  const [{ data: members }, { data: questions }, { count: responseCount }] = await Promise.all([
    supabase
      .from("surveys")
      .select("id, location_id")
      .eq("survey_group_id", survey.survey_group_id)
      .order("created_at"),
    supabase
      .from("survey_questions")
      .select("*")
      .eq("survey_id", survey.id)
      .order("position"),
    supabase
      .from("survey_responses")
      .select("id", { count: "exact", head: true })
      .in("survey_id", (
        await supabase.from("surveys").select("id").eq("survey_group_id", survey.survey_group_id)
      ).data?.map((row) => row.id) ?? [survey.id]),
  ]);

  const questionIds = (questions ?? []).map((question) => question.id);
  const { data: options } = questionIds.length
    ? await supabase
        .from("survey_question_options")
        .select("*")
        .in("question_id", questionIds)
        .order("position")
    : { data: [] };
  const optionsByQuestion = new Map<string, Array<{
    id: string;
    question_id: string;
    label_en: string;
    label_ar: string;
  }>>();
  for (const option of options ?? []) {
    const rows = optionsByQuestion.get(option.question_id) ?? [];
    rows.push(option);
    optionsByQuestion.set(option.question_id, rows);
  }

  const builderQuestions: SurveyBuilderQuestion[] = (questions ?? []).map((question) => {
    const base = {
      id: question.id,
      labelEn: question.prompt_en,
      labelAr: question.prompt_ar === question.prompt_en ? "" : question.prompt_ar,
      helpTextEn: question.help_text_en ?? "",
      helpTextAr: question.help_text_ar ?? "",
      required: question.is_required,
    };
    if (question.question_type === "rating") {
      return { ...base, type: "rating" as const, ratingMin: question.rating_min ?? 1, ratingMax: question.rating_max ?? 5 };
    }
    if (question.question_type === "text") {
      return { ...base, type: "text" as const, textMaxLength: question.text_max_length ?? 1000 };
    }
    return {
      ...base,
      type: "multiple_choice" as const,
      options: (optionsByQuestion.get(question.id) ?? []).map((option) => ({
        id: option.id,
        labelEn: option.label_en,
        labelAr: option.label_ar === option.label_en ? "" : option.label_ar,
      })),
    };
  });

  return {
    draft: {
      surveyId: survey.id,
      titleEn: survey.title_en,
      titleAr: survey.title_ar === survey.title_en ? "" : survey.title_ar,
      descriptionEn: survey.description_en ?? "",
      descriptionAr: survey.description_ar ?? "",
      thankYouEn: survey.thank_you_en ?? "",
      thankYouAr: survey.thank_you_ar ?? "",
      defaultLocale: survey.default_locale,
      locationIds: (members ?? []).map((member) => member.location_id),
      questions: builderQuestions,
    },
    status: survey.status,
    publicSlug: survey.public_slug,
    responseCount: responseCount ?? 0,
  };
}

export async function getSurveyDistribution(surveyId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: survey } = await supabase.from("surveys").select("*").eq("id", surveyId).maybeSingle();
  if (!survey) notFound();
  const [{ data: members }, { data: locations }, { data: organization }] = await Promise.all([
    supabase.from("surveys").select("id, location_id, public_slug, status").eq("survey_group_id", survey.survey_group_id),
    supabase.from("locations").select("id, name_en, name_ar").eq("organization_id", survey.organization_id),
    supabase.from("organizations").select("name_en, name_ar").eq("id", survey.organization_id).single(),
  ]);
  const locationById = new Map((locations ?? []).map((location) => [location.id, location]));
  return {
    titleEn: survey.title_en,
    titleAr: survey.title_ar,
    organization,
    members: (members ?? []).map((member) => ({ ...member, location: locationById.get(member.location_id) ?? null })),
  };
}
