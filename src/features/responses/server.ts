import "server-only";

import { notFound } from "next/navigation";

import { requireAppAccessContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const PAGE_SIZE = 20;

export async function listResponses(filters: {
  q?: string;
  survey?: string;
  location?: string;
  rating?: string;
  page?: string;
}) {
  const context = await requireAppAccessContext();
  const supabase = await createSupabaseServerClient();
  const [{ data: surveys }, { data: locations }] = await Promise.all([
    supabase.from("surveys").select("id, title_en, title_ar"),
    supabase.from("locations").select("id, name_en, name_ar"),
  ]);
  const surveyById = new Map((surveys ?? []).map((survey) => [survey.id, survey]));
  const locationById = new Map((locations ?? []).map((location) => [location.id, location]));
  const search = filters.q?.trim().toLowerCase();
  const searchSurveyIds = search
    ? (surveys ?? []).filter((survey) => `${survey.title_en} ${survey.title_ar}`.toLowerCase().includes(search)).map((survey) => survey.id)
    : null;
  const searchLocationIds = search
    ? (locations ?? []).filter((location) => `${location.name_en} ${location.name_ar}`.toLowerCase().includes(search)).map((location) => location.id)
    : null;
  const page = Math.max(1, Number(filters.page) || 1);
  let query = supabase
    .from("survey_responses")
    .select("id, survey_id, location_id, overall_rating, submitted_at", { count: "exact" })
    .order("submitted_at", { ascending: false });
  if (filters.survey) query = query.eq("survey_id", filters.survey);
  if (filters.location) query = query.eq("location_id", filters.location);
  if (filters.rating && /^\d+$/.test(filters.rating)) query = query.eq("overall_rating", Number(filters.rating));
  if (search && (searchSurveyIds?.length || searchLocationIds?.length)) {
    const parts = [];
    if (searchSurveyIds?.length) parts.push(`survey_id.in.(${searchSurveyIds.join(",")})`);
    if (searchLocationIds?.length) parts.push(`location_id.in.(${searchLocationIds.join(",")})`);
    query = query.or(parts.join(","));
  } else if (search) {
    return { context, rows: [], surveys: surveys ?? [], locations: locations ?? [], page, pageCount: 0 };
  }
  const { data: responses, count, error } = await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (error) throw new Error("Unable to load responses");
  const responseIds = (responses ?? []).map((response) => response.id);
  const { data: alerts } = responseIds.length
    ? await supabase.from("alerts").select("response_id, status, alert_type").in("response_id", responseIds)
    : { data: [] };
  const alertByResponse = new Map((alerts ?? []).map((alert) => [alert.response_id, alert]));
  return {
    context,
    surveys: surveys ?? [],
    locations: locations ?? [],
    page,
    pageCount: Math.ceil((count ?? 0) / PAGE_SIZE),
    rows: (responses ?? []).map((response) => ({
      ...response,
      survey: surveyById.get(response.survey_id) ?? null,
      location: locationById.get(response.location_id) ?? null,
      alert: alertByResponse.get(response.id) ?? null,
    })),
  };
}

export async function getResponseDetail(responseId: string) {
  await requireAppAccessContext();
  const supabase = await createSupabaseServerClient();
  const { data: response } = await supabase.from("survey_responses").select("*").eq("id", responseId).maybeSingle();
  if (!response) notFound();
  const [{ data: survey }, { data: location }, { data: organization }, { data: questions }, { data: answers }, { data: alerts }] = await Promise.all([
    supabase.from("surveys").select("title_en, title_ar").eq("id", response.survey_id).single(),
    supabase.from("locations").select("name_en, name_ar").eq("id", response.location_id).single(),
    supabase.from("organizations").select("name_en, name_ar").eq("id", response.organization_id).single(),
    supabase.from("survey_questions").select("id, prompt_en, prompt_ar, question_type, position").eq("survey_id", response.survey_id).order("position"),
    supabase.from("survey_answers").select("id, question_id, rating_value, text_value").eq("response_id", response.id),
    supabase.from("alerts").select("status, alert_type, rating_value, threshold_value").eq("response_id", response.id),
  ]);
  const answerIds = (answers ?? []).map((answer) => answer.id);
  const questionIds = (questions ?? []).map((question) => question.id);
  const [{ data: choices }, { data: options }] = await Promise.all([
    answerIds.length ? supabase.from("survey_answer_choices").select("answer_id, option_id").in("answer_id", answerIds) : Promise.resolve({ data: [] }),
    questionIds.length ? supabase.from("survey_question_options").select("id, label_en, label_ar").in("question_id", questionIds) : Promise.resolve({ data: [] }),
  ]);
  const optionById = new Map((options ?? []).map((option) => [option.id, option]));
  const choicesByAnswer = new Map<string, Array<{ answer_id: string; option_id: string }>>();
  for (const choice of choices ?? []) {
    const rows = choicesByAnswer.get(choice.answer_id) ?? [];
    rows.push(choice);
    choicesByAnswer.set(choice.answer_id, rows);
  }
  const answerByQuestion = new Map((answers ?? []).map((answer) => [answer.question_id, answer]));
  return {
    response,
    survey,
    location,
    organization,
    alerts: alerts ?? [],
    answers: (questions ?? []).map((question) => {
      const answer = answerByQuestion.get(question.id);
      return {
        question,
        rating: answer?.rating_value ?? null,
        text: answer?.text_value ?? null,
        choices: answer ? (choicesByAnswer.get(answer.id) ?? []).map((choice) => optionById.get(choice.option_id)).filter(Boolean) : [],
      };
    }),
  };
}
