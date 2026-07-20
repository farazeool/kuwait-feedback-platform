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
  workflow?: string;
  tag?: string;
  assignee?: string;
  alert?: string;
  unresolved?: string;
  page?: string;
}) {
  const context = await requireAppAccessContext();
  const supabase = await createSupabaseServerClient();
  const [{ data: surveys }, { data: locations }, { data: profiles }] = await Promise.all([
    supabase.from("surveys").select("id, title_en, title_ar"),
    supabase.from("locations").select("id, name_en, name_ar"),
    supabase.from("profiles").select("id, display_name").order("display_name"),
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
  const page = Math.min(10000, Math.max(1, Number(filters.page) || 1));
  let alertResponseIds: string[] | null = null;
  if (["open", "acknowledged", "resolved", "dismissed"].includes(filters.alert ?? "")) {
    const { data: matchingAlerts } = await supabase.from("alerts").select("response_id").eq("status", filters.alert as "open").not("response_id", "is", null);
    alertResponseIds = (matchingAlerts ?? []).flatMap((alert) => alert.response_id ? [alert.response_id] : []);
  }
  let query = supabase
    .from("survey_responses")
    .select("id, survey_id, location_id, overall_rating, submitted_at, workflow_status, internal_tags, assigned_to", { count: "exact" })
    .order("submitted_at", { ascending: false });
  if (filters.survey) query = query.eq("survey_id", filters.survey);
  if (filters.location) query = query.eq("location_id", filters.location);
  if (filters.rating && /^\d+$/.test(filters.rating)) query = query.eq("overall_rating", Number(filters.rating));
  if (["unread", "reviewed", "action_required", "resolved"].includes(filters.workflow ?? "")) query = query.eq("workflow_status", filters.workflow as "unread");
  if (filters.unresolved === "1") query = query.neq("workflow_status", "resolved");
  if (filters.tag?.trim()) query = query.contains("internal_tags", [filters.tag.trim().slice(0, 40)]);
  if (profiles?.some((profile) => profile.id === filters.assignee)) query = query.eq("assigned_to", filters.assignee!);
  if (alertResponseIds) {
    if (!alertResponseIds.length) return { context, rows: [], surveys: surveys ?? [], locations: locations ?? [], profiles: profiles ?? [], page, pageCount: 0 };
    query = query.in("id", alertResponseIds.slice(0, 10000));
  }
  if (search && (searchSurveyIds?.length || searchLocationIds?.length)) {
    const parts = [];
    if (searchSurveyIds?.length) parts.push(`survey_id.in.(${searchSurveyIds.join(",")})`);
    if (searchLocationIds?.length) parts.push(`location_id.in.(${searchLocationIds.join(",")})`);
    query = query.or(parts.join(","));
  } else if (search) {
    return { context, rows: [], surveys: surveys ?? [], locations: locations ?? [], profiles: profiles ?? [], page, pageCount: 0 };
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
    profiles: profiles ?? [],
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
  const context = await requireAppAccessContext();
  const supabase = await createSupabaseServerClient();
  const { data: response } = await supabase.from("survey_responses").select("*").eq("id", responseId).maybeSingle();
  if (!response) notFound();
  const [{ data: survey }, { data: location }, { data: organization }, { data: questions }, { data: answers }, { data: alerts }, { data: notes }, { data: profiles }, { data: canManage }] = await Promise.all([
    supabase.from("surveys").select("title_en, title_ar").eq("id", response.survey_id).single(),
    supabase.from("locations").select("name_en, name_ar").eq("id", response.location_id).single(),
    supabase.from("organizations").select("name_en, name_ar").eq("id", response.organization_id).single(),
    supabase.from("survey_questions").select("id, prompt_en, prompt_ar, question_type, position").eq("survey_id", response.survey_id).order("position"),
    supabase.from("survey_answers").select("id, question_id, rating_value, text_value").eq("response_id", response.id),
    supabase.from("alerts").select("status, alert_type, rating_value, threshold_value").eq("response_id", response.id),
    supabase.from("response_internal_notes").select("id, author_id, note, created_at").eq("response_id", response.id).order("created_at", { ascending: false }).limit(50),
    supabase.from("profiles").select("id, display_name").order("display_name"),
    supabase.rpc("can_manage_response", { p_response_id: response.id }),
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
    context,
    response,
    survey,
    location,
    organization,
    alerts: alerts ?? [],
    notes: notes ?? [],
    profiles: profiles?.length ? profiles : [{ id: context.user.id, display_name: context.profile.displayName }],
    canManage: Boolean(canManage),
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
