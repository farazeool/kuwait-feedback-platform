import "server-only";

import { requireAppAccessContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ReportFilters = {
  startAt?: string;
  endAt?: string;
  locationId?: string;
  surveyId?: string;
};

export async function listAvailableSurveys() {
  const context = await requireAppAccessContext();
  if (!context.organization) return { context, surveys: [] as Array<{ id: string; title_en: string; title_ar: string; location_id: string | null }> };
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("surveys")
    .select("id, title_en, title_ar, location_id")
    .eq("organization_id", context.organization.id)
    .order("title_en");
  return { context, surveys: data ?? [] };
}

export async function fetchReportLocations() {
  const context = await requireAppAccessContext();
  const supabase = await createSupabaseServerClient();
  if (!context.organization) return [];
  const { data } = await supabase
    .from("locations")
    .select("id, name_en, name_ar")
    .eq("organization_id", context.organization.id)
    .eq("status", "active")
    .order("name_en");
  return data ?? [];
}

type Json = Record<string, unknown>;

export async function generateMonthlyReport(filters: ReportFilters) {
  const context = await requireAppAccessContext();
  const supabase = await createSupabaseServerClient();
  if (!context.organization) throw new Error("Organization required");

  const orgId = context.organization.id;
  const startAt = filters.startAt;
  const endAt = filters.endAt;

  if (!startAt || !endAt) return { context, report: null };

  const base = {
    p_organization_id: orgId,
    p_start_at: new Date(startAt).toISOString(),
    p_end_at: new Date(endAt).toISOString(),
  };

  // KPI data via RPC
  const { data: kpiData } = await supabase.rpc("get_kpi_dashboard", {
    ...base,
    ...(filters.locationId ? { p_location_id: filters.locationId } : {}),
    ...(filters.surveyId ? { p_survey_id: filters.surveyId } : {}),
  });

  // Concern trend via RPC
  const { data: concernTrend } = await supabase.rpc("get_concern_trend", {
    ...base,
    ...(filters.locationId ? { p_location_id: filters.locationId } : {}),
    ...(filters.surveyId ? { p_survey_id: filters.surveyId } : {}),
  });

  // Alert summary
  const alertBase = { p_organization_id: orgId, p_start_at: base.p_start_at, p_end_at: base.p_end_at };
  const { data: alertSummary } = await supabase.rpc("get_alert_summary", {
    ...alertBase,
    ...(filters.locationId ? { p_location_id: filters.locationId } : {}),
  });

  // Review outcome summary
  const { data: reviewOutcomes } = await supabase.rpc("get_review_summary", {
    ...alertBase,
    ...(filters.locationId ? { p_location_id: filters.locationId } : {}),
  });

  // Previous period for comparison
  const prevStart = new Date(new Date(startAt).getTime() - (new Date(endAt).getTime() - new Date(startAt).getTime())).toISOString();
  const prevEnd = startAt;
  const { data: prevKpiData } = await supabase.rpc("get_kpi_dashboard", {
    p_organization_id: orgId,
    p_start_at: prevStart,
    p_end_at: prevEnd,
    ...(filters.locationId ? { p_location_id: filters.locationId } : {}),
    ...(filters.surveyId ? { p_survey_id: filters.surveyId } : {}),
  });

  return {
    context,
    report: {
      kpi: kpiData as Json | null,
      concernTrend: (concernTrend as Json[]) ?? [],
      alertSummary: (alertSummary as Json[]) ?? [],
      reviewOutcomes: (reviewOutcomes as Json[]) ?? [],
      prevKpi: prevKpiData as Json | null,
      period: { startAt, endAt, prevStart, prevEnd },
    },
  };
}