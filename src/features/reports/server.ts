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

  const startDate = new Date(startAt);
  const endDate = new Date(endAt);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
    return { context, report: null };
  }

  const base = {
    p_organization_id: orgId,
    p_start_at: startDate.toISOString(),
    p_end_at: endDate.toISOString(),
  };

  const alertBase = { p_organization_id: orgId, p_start_at: base.p_start_at, p_end_at: base.p_end_at };

  // Execute all independent RPCs in parallel
  const rpcCalls = await Promise.allSettled([
    supabase.rpc("get_kpi_dashboard", { ...base, ...(filters.locationId ? { p_location_id: filters.locationId } : {}), ...(filters.surveyId ? { p_survey_id: filters.surveyId } : {}) }),
    supabase.rpc("get_concern_trend", { ...base, ...(filters.locationId ? { p_location_id: filters.locationId } : {}), ...(filters.surveyId ? { p_survey_id: filters.surveyId } : {}) }),
    supabase.rpc("get_alert_summary", { ...alertBase, ...(filters.locationId ? { p_location_id: filters.locationId } : {}) }),
    supabase.rpc("get_review_summary", { ...alertBase, ...(filters.locationId ? { p_location_id: filters.locationId } : {}) }),
    supabase.rpc("get_corrective_action_stats", { p_organization_id: orgId, p_start_at: base.p_start_at, p_end_at: base.p_end_at, ...(filters.locationId ? { p_location_id: filters.locationId } : {}) }),
    supabase.rpc("get_branch_ranking", { p_organization_id: orgId, p_start_at: base.p_start_at, p_end_at: base.p_end_at }),
    supabase.rpc("get_department_ranking", { p_organization_id: orgId, p_start_at: base.p_start_at, p_end_at: base.p_end_at }),
    supabase.rpc("get_alert_severity_breakdown", { p_organization_id: orgId, p_start_at: base.p_start_at, p_end_at: base.p_end_at, ...(filters.locationId ? { p_location_id: filters.locationId } : {}) }),
    supabase.rpc("get_alert_trigger_breakdown", { p_organization_id: orgId, p_start_at: base.p_start_at, p_end_at: base.p_end_at, ...(filters.locationId ? { p_location_id: filters.locationId } : {}) }),
  ]);

  const extract = <T,>(result: PromiseSettledResult<{ data: T; error: unknown }>): T | null =>
    result.status === "fulfilled" && result.value.data ? result.value.data : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kpiData = extract<any>(rpcCalls[0]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const concernTrend = extract<any>(rpcCalls[1]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const alertSummary = extract<any>(rpcCalls[2]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reviewOutcomes = extract<any>(rpcCalls[3]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const correctiveActionsSummary = extract<any>(rpcCalls[4]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const branchRanking = extract<any>(rpcCalls[5]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const departmentRanking = extract<any>(rpcCalls[6]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const alertSeverityBreakdown = extract<any>(rpcCalls[7]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const triggerBreakdown = extract<any>(rpcCalls[8]);

  // Management decisions from investigations
  const { data: managementDecisions } = await (supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<{ data: Json[] | null }>)("get_management_decisions", {
    p_organization_id: orgId,
    p_start_at: base.p_start_at,
    p_end_at: base.p_end_at,
    ...(filters.locationId ? { p_location_id: filters.locationId } : {}),
  });

  // Follow-up records from review audit
  const { data: followupRecords } = await (supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<{ data: Json[] | null }>)("get_followup_records", {
    p_organization_id: orgId,
    p_start_at: base.p_start_at,
    p_end_at: base.p_end_at,
    ...(filters.locationId ? { p_location_id: filters.locationId } : {}),
  });

  // Corrective action verification status
  const { data: correctiveActionVerification } = await (supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<{ data: Json | null }>)("get_corrective_action_verification", {
    p_organization_id: orgId,
    p_start_at: base.p_start_at,
    p_end_at: base.p_end_at,
    ...(filters.locationId ? { p_location_id: filters.locationId } : {}),
  });

  // Corrective action effectiveness review
  const { data: correctiveActionEffectiveness } = await (supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<{ data: Json | null }>)("get_corrective_action_effectiveness", {
    p_organization_id: orgId,
    p_start_at: base.p_start_at,
    p_end_at: base.p_end_at,
    ...(filters.locationId ? { p_location_id: filters.locationId } : {}),
  });

  // Controlled record references from survey responses
  const { data: controlledRecordRefs } = await (supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<{ data: Json[] | null }>)("get_controlled_record_references", {
    p_organization_id: orgId,
    p_start_at: base.p_start_at,
    p_end_at: base.p_end_at,
    ...(filters.locationId ? { p_location_id: filters.locationId } : {}),
  });

  // Target status (pass/warning/fail)
  const { data: targetStatus } = await (supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<{ data: Json | null }>)("get_target_status", {
    p_organization_id: orgId,
    p_start_at: base.p_start_at,
    p_end_at: base.p_end_at,
    ...(filters.locationId ? { p_location_id: filters.locationId } : {}),
  });

  // Concern and response trends for charts
  const { data: trendCharts } = await (supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<{ data: Json | null }>)("get_concern_response_trends", {
    p_organization_id: orgId,
    p_start_at: base.p_start_at,
    p_end_at: base.p_end_at,
    ...(filters.locationId ? { p_location_id: filters.locationId } : {}),
    p_bucket: "week",
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
      correctiveActions: (correctiveActionsSummary as Json | null),
      branchRanking: (branchRanking as Json[]) ?? [],
      departmentRanking: (departmentRanking as Json[]) ?? [],
      alertSeverityBreakdown: (alertSeverityBreakdown as Json[]) ?? [],
      triggerBreakdown: (triggerBreakdown as Json[]) ?? [],
      managementDecisions: (managementDecisions as Json[]) ?? [],
      followupRecords: (followupRecords as Json[]) ?? [],
      correctiveActionVerification: (correctiveActionVerification as Json | null),
      correctiveActionEffectiveness: (correctiveActionEffectiveness as Json | null),
      controlledRecordRefs: (controlledRecordRefs as Json[]) ?? [],
      targetStatus: (targetStatus as Json | null),
      trendCharts: (trendCharts as Json | null),
      prevKpi: prevKpiData as Json | null,
      period: { startAt, endAt, prevStart, prevEnd },
    },
  };
}

export async function getCorrectiveActionsList(filters: {
  organizationId: string;
  status?: string;
  priority?: string;
  locationId?: string;
  limit?: number;
  offset?: number;
}) {
  const context = await requireAppAccessContext();
  const supabase = await createSupabaseServerClient();
  if (!context.organization) return { context, actions: [], total: 0 };

  let query = supabase
    .from("corrective_actions")
    .select("*, branch:locations!branch_id(id, name_en, name_ar), department:departments!department_id(id, name_en, name_ar), assigned_owner:profiles!assigned_owner_id(display_name, email), alerts:alerts!related_alert_id(id, alert_type, severity)", { count: "exact" })
    .eq("organization_id", context.organization.id)
    .order("created_at", { ascending: false });

  if (filters.status) query = query.eq("status", filters.status as "open" | "rejected" | "draft" | "in_progress" | "pending_verification" | "verified" | "effectiveness_review" | "closed");
  if (filters.priority) query = query.eq("priority", filters.priority as "low" | "medium" | "high" | "critical");
  if (filters.locationId) query = query.eq("branch_id", filters.locationId);
  if (filters.limit) query = query.limit(filters.limit);
  if (filters.offset) query = query.range(filters.offset, filters.offset + (filters.limit ?? 20) - 1);

  const { data, error, count } = await query;
  if (error) throw new Error("Failed to load corrective actions");

  return { context, actions: data ?? [], total: count ?? 0 };
}