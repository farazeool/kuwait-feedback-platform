import { NextResponse, type NextRequest } from "next/server";

import { resolveAnalyticsRange } from "@/features/analytics/dates";
import { analyticsOverviewSchema, exportFiltersSchema } from "@/features/analytics/schema";
import { CSV_BOM, csvLine, safeExportFilename } from "@/features/exports/csv";
import { getAppAccessContext } from "@/lib/auth/context";
import { formatKuwaitDateTime } from "@/lib/datetime/kuwait";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const PAGE_SIZE = 500;
const MAX_ROWS = 10000;
const KINDS = ["responses", "response_answers", "survey_summaries", "location_summaries", "alert_reports"] as const;
type ExportKind = typeof KINDS[number];

export async function GET(request: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const context = await getAppAccessContext();
  if (!context) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { kind: rawKind } = await params;
  if (!KINDS.includes(rawKind as ExportKind)) return NextResponse.json({ error: "Export unavailable" }, { status: 404 });
  const kind = rawKind as ExportKind;
  const raw = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = exportFiltersSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid export filters" }, { status: 400 });
  let range;
  try { range = resolveAnalyticsRange(parsed.data); } catch { return NextResponse.json({ error: "Invalid export range" }, { status: 400 }); }
  const supabase = await createSupabaseServerClient();
  const { data: organizations } = await supabase.from("organizations").select("id").eq("status", "active");
  const organizationId = organizations?.some((row) => row.id === parsed.data.organization) ? parsed.data.organization! : context.organization?.id ?? organizations?.[0]?.id;
  if (!organizationId) return NextResponse.json({ error: "No permitted organization" }, { status: 403 });
  const [{ data: locations }, { data: surveys }] = await Promise.all([
    supabase.from("locations").select("id, name_en, name_ar").eq("organization_id", organizationId),
    supabase.from("surveys").select("id, title_en, title_ar").eq("organization_id", organizationId),
  ]);
  const locationId = locations?.some((row) => row.id === parsed.data.location) ? parsed.data.location : undefined;
  const surveyId = surveys?.some((row) => row.id === parsed.data.survey) ? parsed.data.survey : undefined;
  if (parsed.data.organization && parsed.data.organization !== organizationId) return NextResponse.json({ error: "Organization unavailable" }, { status: 403 });
  if (parsed.data.location && !locationId) return NextResponse.json({ error: "Location unavailable" }, { status: 403 });
  if (parsed.data.survey && !surveyId) return NextResponse.json({ error: "Survey unavailable" }, { status: 403 });
  const search = parsed.data.q?.toLowerCase();
  const searchSurveyIds = search ? (surveys ?? []).filter((row) => `${row.title_en} ${row.title_ar}`.toLowerCase().includes(search)).map((row) => row.id) : [];
  const searchLocationIds = search ? (locations ?? []).filter((row) => `${row.name_en} ${row.name_ar}`.toLowerCase().includes(search)).map((row) => row.id) : [];
  let alertResponseIds: string[] | null = null;
  if (parsed.data.alert) {
    const { data: alertRows, error: alertError } = await supabase.from("alerts").select("response_id").eq("organization_id", organizationId).eq("status", parsed.data.alert).not("response_id", "is", null).limit(MAX_ROWS);
    if (alertError) return NextResponse.json({ error: "Export filters unavailable" }, { status: 400 });
    alertResponseIds = (alertRows ?? []).flatMap((row) => row.response_id ? [row.response_id] : []);
  }
  const { error: auditError } = await supabase.rpc("record_data_export", {
    p_organization_id: organizationId,
    p_export_type: kind,
    p_filters: { range: { from: range.from, to: range.to }, location: locationId ?? null, survey: surveyId ?? null },
  });
  if (auditError) return NextResponse.json({ error: "Export authorization denied" }, { status: 403 });

  const encoder = new TextEncoder();
  const locationById = new Map((locations ?? []).map((row) => [row.id, row]));
  const surveyById = new Map((surveys ?? []).map((row) => [row.id, row]));
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(CSV_BOM));
        if (kind === "responses") {
          controller.enqueue(encoder.encode(csvLine(["submitted_utc", "submitted_kuwait", "survey_en", "survey_ar", "location_en", "location_ar", "rating", "workflow_status", "tags", "assigned"])))
          let emitted = 0;
          while (emitted < MAX_ROWS) {
            let query = supabase.from("survey_responses").select("survey_id, location_id, submitted_at, overall_rating, workflow_status, internal_tags, assigned_to").eq("organization_id", organizationId).gte("submitted_at", range.start).lt("submitted_at", range.end).order("submitted_at").range(emitted, Math.min(emitted + PAGE_SIZE, MAX_ROWS) - 1);
            if (locationId) query = query.eq("location_id", locationId);
            if (surveyId) query = query.eq("survey_id", surveyId);
            if (parsed.data.ratingMin !== undefined) query = query.gte("overall_rating", parsed.data.ratingMin);
            if (parsed.data.ratingMax !== undefined) query = query.lte("overall_rating", parsed.data.ratingMax);
            if (parsed.data.rating !== undefined) query = query.eq("overall_rating", parsed.data.rating);
            if (parsed.data.workflow) query = query.eq("workflow_status", parsed.data.workflow);
            if (parsed.data.unresolved === "1") query = query.neq("workflow_status", "resolved");
            if (parsed.data.tag) query = query.contains("internal_tags", [parsed.data.tag]);
            if (parsed.data.assignee) query = query.eq("assigned_to", parsed.data.assignee);
            if (search && (searchSurveyIds.length || searchLocationIds.length)) {
              const parts = [];
              if (searchSurveyIds.length) parts.push(`survey_id.in.(${searchSurveyIds.join(",")})`);
              if (searchLocationIds.length) parts.push(`location_id.in.(${searchLocationIds.join(",")})`);
              query = query.or(parts.join(","));
            } else if (search) break;
            if (alertResponseIds) {
              if (!alertResponseIds.length) break;
              query = query.in("id", alertResponseIds);
            }
            const { data, error } = await query;
            if (error) throw error;
            for (const row of data ?? []) controller.enqueue(encoder.encode(csvLine([row.submitted_at, formatKuwaitDateTime(row.submitted_at), surveyById.get(row.survey_id)?.title_en, surveyById.get(row.survey_id)?.title_ar, locationById.get(row.location_id)?.name_en, locationById.get(row.location_id)?.name_ar, row.overall_rating, row.workflow_status, row.internal_tags.join("; "), row.assigned_to ? "assigned" : "unassigned"])));
            emitted += data?.length ?? 0;
            if (!data || data.length < PAGE_SIZE) break;
          }
        } else if (kind === "alert_reports") {
          controller.enqueue(encoder.encode(csvLine(["created_utc", "created_kuwait", "location_en", "type", "status", "rating", "threshold", "assigned"])))
          let emitted = 0;
          while (emitted < MAX_ROWS) {
            let query = supabase.from("alerts").select("location_id, alert_type, status, rating_value, threshold_value, assigned_to, created_at").eq("organization_id", organizationId).gte("created_at", range.start).lt("created_at", range.end).order("created_at").range(emitted, Math.min(emitted + PAGE_SIZE, MAX_ROWS) - 1);
            if (locationId) query = query.eq("location_id", locationId);
            if (parsed.data.alertStatus) query = query.eq("status", parsed.data.alertStatus);
            if (parsed.data.assignee) query = query.eq("assigned_to", parsed.data.assignee);
            const { data, error } = await query;
            if (error) throw error;
            for (const row of data ?? []) controller.enqueue(encoder.encode(csvLine([row.created_at, formatKuwaitDateTime(row.created_at), locationById.get(row.location_id)?.name_en, row.alert_type, row.status, row.rating_value, row.threshold_value, row.assigned_to ? "assigned" : "unassigned"])));
            emitted += data?.length ?? 0;
            if (!data || data.length < PAGE_SIZE) break;
          }
        } else if (kind === "response_answers") {
          controller.enqueue(encoder.encode(csvLine(["submitted_utc", "submitted_kuwait", "survey_en", "location_en", "question_en", "question_ar", "answer_type", "rating", "text", "choices"])))
          let responseOffset = 0;
          let emitted = 0;
          while (emitted < MAX_ROWS) {
            let responseQuery = supabase.from("survey_responses").select("id, survey_id, location_id, submitted_at").eq("organization_id", organizationId).gte("submitted_at", range.start).lt("submitted_at", range.end).order("submitted_at").range(responseOffset, responseOffset + PAGE_SIZE - 1);
            if (locationId) responseQuery = responseQuery.eq("location_id", locationId);
            if (surveyId) responseQuery = responseQuery.eq("survey_id", surveyId);
            if (parsed.data.ratingMin !== undefined) responseQuery = responseQuery.gte("overall_rating", parsed.data.ratingMin);
            if (parsed.data.ratingMax !== undefined) responseQuery = responseQuery.lte("overall_rating", parsed.data.ratingMax);
            if (parsed.data.rating !== undefined) responseQuery = responseQuery.eq("overall_rating", parsed.data.rating);
            if (parsed.data.workflow) responseQuery = responseQuery.eq("workflow_status", parsed.data.workflow);
            if (parsed.data.unresolved === "1") responseQuery = responseQuery.neq("workflow_status", "resolved");
            if (parsed.data.tag) responseQuery = responseQuery.contains("internal_tags", [parsed.data.tag]);
            if (parsed.data.assignee) responseQuery = responseQuery.eq("assigned_to", parsed.data.assignee);
            if (search && (searchSurveyIds.length || searchLocationIds.length)) {
              const parts = [];
              if (searchSurveyIds.length) parts.push(`survey_id.in.(${searchSurveyIds.join(",")})`);
              if (searchLocationIds.length) parts.push(`location_id.in.(${searchLocationIds.join(",")})`);
              responseQuery = responseQuery.or(parts.join(","));
            } else if (search) break;
            if (alertResponseIds) {
              if (!alertResponseIds.length) break;
              responseQuery = responseQuery.in("id", alertResponseIds);
            }
            const { data: responses, error } = await responseQuery;
            if (error) throw error;
            const ids = (responses ?? []).map((row) => row.id);
            if (!ids.length) break;
            const { data: answers, error: answersError } = await supabase.from("survey_answers").select("id, response_id, question_id, rating_value, text_value").in("response_id", ids);
            if (answersError) throw answersError;
            const questionIds = [...new Set((answers ?? []).map((row) => row.question_id))];
            const answerIds = (answers ?? []).map((row) => row.id);
            const [{ data: questions }, { data: choices }] = await Promise.all([
              questionIds.length ? supabase.from("survey_questions").select("id, prompt_en, prompt_ar, question_type").in("id", questionIds) : Promise.resolve({ data: [] }),
              answerIds.length ? supabase.from("survey_answer_choices").select("answer_id, option_id").in("answer_id", answerIds) : Promise.resolve({ data: [] }),
            ]);
            const optionIds = [...new Set((choices ?? []).map((row) => row.option_id))];
            const { data: options } = optionIds.length ? await supabase.from("survey_question_options").select("id, label_en, label_ar").in("id", optionIds) : { data: [] };
            const responseById = new Map((responses ?? []).map((row) => [row.id, row]));
            const questionById = new Map((questions ?? []).map((row) => [row.id, row]));
            const optionById = new Map((options ?? []).map((row) => [row.id, row]));
            const choiceByAnswer = new Map<string, string[]>();
            for (const choice of choices ?? []) choiceByAnswer.set(choice.answer_id, [...(choiceByAnswer.get(choice.answer_id) ?? []), optionById.get(choice.option_id)?.label_en ?? ""]);
            for (const answer of answers ?? []) {
              if (emitted >= MAX_ROWS) break;
              const response = responseById.get(answer.response_id);
              const question = questionById.get(answer.question_id);
              if (response && question) {
                controller.enqueue(encoder.encode(csvLine([response.submitted_at, formatKuwaitDateTime(response.submitted_at), surveyById.get(response.survey_id)?.title_en, locationById.get(response.location_id)?.name_en, question.prompt_en, question.prompt_ar, question.question_type, answer.rating_value, answer.text_value, (choiceByAnswer.get(answer.id) ?? []).join("; ")])));
                emitted += 1;
              }
            }
            responseOffset += responses?.length ?? 0;
            if (!responses || responses.length < PAGE_SIZE) break;
          }
        } else {
          const { data, error } = await supabase.rpc("get_analytics_overview", { p_organization_id: organizationId, p_start_at: range.start, p_end_at: range.end, p_location_id: locationId, p_survey_id: surveyId, p_bucket: range.bucket });
          if (error) throw error;
          const overview = analyticsOverviewSchema.parse(data);
          if (kind === "survey_summaries") {
            controller.enqueue(encoder.encode(csvLine(["survey_en", "survey_ar", "response_count", "normalized_average"])));
            for (const row of overview.survey_comparison) controller.enqueue(encoder.encode(csvLine([row.title_en, row.title_ar, row.response_count, row.average_normalized])));
          } else {
            controller.enqueue(encoder.encode(csvLine(["location_en", "location_ar", "response_count", "normalized_average", "sufficient_for_ranking"])));
            for (const row of overview.location_comparison) controller.enqueue(encoder.encode(csvLine([row.name_en, row.name_ar, row.response_count, row.average_normalized, row.sufficient_data])));
          }
        }
        controller.close();
      } catch (error) {
        console.error(JSON.stringify({ event: "csv_export_failed", kind, reason: error instanceof Error ? error.name : "unknown" }));
        controller.error(new Error("Export failed"));
      }
    },
  });
  return new NextResponse(stream, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${safeExportFilename(kind, range.to)}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
