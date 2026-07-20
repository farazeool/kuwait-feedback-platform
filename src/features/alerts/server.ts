import "server-only";

import { notFound } from "next/navigation";

import { requireAppAccessContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const PAGE_SIZE = 20;

export async function listAlerts(filters: { status?: string; location?: string; assigned?: string; page?: string }) {
  const context = await requireAppAccessContext();
  const supabase = await createSupabaseServerClient();
  const page = Math.min(10000, Math.max(1, Number(filters.page) || 1));
  const [{ data: locations }, { data: profiles }] = await Promise.all([
    supabase.from("locations").select("id, name_en, name_ar").order("name_en"),
    supabase.from("profiles").select("id, display_name").order("display_name"),
  ]);
  let query = supabase.from("alerts").select("id, organization_id, location_id, response_id, alert_type, status, rating_value, threshold_value, assigned_to, created_at", { count: "exact" }).order("created_at", { ascending: false });
  if (["open", "acknowledged", "resolved", "dismissed"].includes(filters.status ?? "")) query = query.eq("status", filters.status as "open");
  if (locations?.some((row) => row.id === filters.location)) query = query.eq("location_id", filters.location!);
  if (profiles?.some((row) => row.id === filters.assigned)) query = query.eq("assigned_to", filters.assigned!);
  const { data: alerts, count, error } = await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (error) throw new Error("Unable to load alerts");
  const responseIds = (alerts ?? []).flatMap((alert) => alert.response_id ? [alert.response_id] : []);
  const { data: responses } = responseIds.length ? await supabase.from("survey_responses").select("id, survey_id").in("id", responseIds) : { data: [] };
  const surveyIds = (responses ?? []).map((response) => response.survey_id);
  const { data: surveys } = surveyIds.length ? await supabase.from("surveys").select("id, title_en, title_ar").in("id", surveyIds) : { data: [] };
  const locationById = new Map((locations ?? []).map((row) => [row.id, row]));
  const responseById = new Map((responses ?? []).map((row) => [row.id, row]));
  const surveyById = new Map((surveys ?? []).map((row) => [row.id, row]));
  const profileById = new Map((profiles ?? []).map((row) => [row.id, row]));
  return { context, locations: locations ?? [], profiles: profiles ?? [], page, pageCount: Math.ceil((count ?? 0) / PAGE_SIZE), rows: (alerts ?? []).map((alert) => { const response = alert.response_id ? responseById.get(alert.response_id) : null; return { ...alert, location: locationById.get(alert.location_id) ?? null, survey: response ? surveyById.get(response.survey_id) ?? null : null, assignee: alert.assigned_to ? profileById.get(alert.assigned_to) ?? null : null }; }) };
}

export async function getAlertDetail(alertId: string) {
  const context = await requireAppAccessContext();
  const supabase = await createSupabaseServerClient();
  const { data: alert } = await supabase.from("alerts").select("*").eq("id", alertId).maybeSingle();
  if (!alert) notFound();
  const [{ data: location }, { data: response }, { data: profiles }, { data: canManage }] = await Promise.all([
    supabase.from("locations").select("name_en, name_ar").eq("id", alert.location_id).single(),
    alert.response_id ? supabase.from("survey_responses").select("id, survey_id, submitted_at, overall_rating").eq("id", alert.response_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("profiles").select("id, display_name").order("display_name"),
    supabase.rpc("can_manage_alert", { p_alert_id: alertId }),
  ]);
  const { data: survey } = response ? await supabase.from("surveys").select("title_en, title_ar").eq("id", response.survey_id).single() : { data: null };
  const availableProfiles = profiles?.length ? profiles : [{ id: context.user.id, display_name: context.profile.displayName }];
  return { context, alert, location, response, survey, profiles: availableProfiles, canManage: Boolean(canManage) };
}
