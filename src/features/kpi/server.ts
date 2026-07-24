import "server-only";

import { notFound } from "next/navigation";

import { requireAppAccessContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type KpiFilters = {
  startAt?: string;
  endAt?: string;
  locationId?: string;
  surveyId?: string;
  departmentId?: string;
  touchpointId?: string;
  channel?: string;
};

export type KpiData = {
  total_responses: number;
  rated_responses: number;
  average_rating: number | null;
  satisfaction_pct: number | null;
  negative_feedback_pct: number | null;
  satisfied_min: number;
  negative_max: number;
  top_concerns: Array<{ slug: string; name_en: string; name_ar: string; count: number }>;
  location_kpis: Array<{ id: string; name_en: string; name_ar: string; response_count: number; average_rating: number | null; satisfaction_pct: number | null; negative_feedback_pct: number | null }>;
  department_kpis: Array<{ id: string; name_en: string; name_ar: string; response_count: number; average_rating: number | null }>;
  touchpoint_kpis: Array<{ id: string; name_en: string; name_ar: string; response_count: number; average_rating: number | null }>;
  channel_breakdown: Array<{ channel: string; count: number }>;
  response_trend: Array<{ period: string; count: number; satisfied: number; negative: number }>;
  prev_satisfaction_pct: number | null;
  prev_negative_feedback_pct: number | null;
};

export async function getKpiDashboard(filters: KpiFilters = {}) {
  const context = await requireAppAccessContext();
  const supabase = await createSupabaseServerClient();
  if (!context.organization) notFound();
  const organizationId = context.organization.id;

  // Default to current month if no date range
  const now = new Date();
  const startAt = filters.startAt || new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const endAt = filters.endAt || new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

  const required = {
    p_organization_id: organizationId,
    p_start_at: startAt,
    p_end_at: endAt,
  };
  const { data, error } = await supabase.rpc("get_kpi_dashboard", {
    ...required,
    ...(filters.locationId ? { p_location_id: filters.locationId } : {}),
    ...(filters.surveyId ? { p_survey_id: filters.surveyId } : {}),
    ...(filters.departmentId ? { p_department_id: filters.departmentId } : {}),
    ...(filters.touchpointId ? { p_touchpoint_id: filters.touchpointId } : {}),
    ...(filters.channel ? { p_channel: filters.channel } : {}),
  });
  if (error) {
    console.error("KPI RPC failed:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    throw error;
  }

  // Fetch filter options
  const [locations, surveys, departments, touchpoints] = await Promise.all([
    supabase.from("locations").select("id, name_en").eq("organization_id", organizationId).eq("status", "active").order("name_en"),
    supabase.from("surveys").select("id, title_en").eq("organization_id", organizationId).order("title_en"),
    supabase.from("departments").select("id, name_en").eq("organization_id", organizationId).eq("status", "active").order("name_en"),
    supabase.from("touchpoints").select("id, name_en").eq("organization_id", organizationId).eq("status", "active").order("name_en"),
  ]);

  return {
    context,
    data: data as KpiData | null,
    filters: {
      locations: locations.data ?? [],
      surveys: surveys.data ?? [],
      departments: departments.data ?? [],
      touchpoints: touchpoints.data ?? [],
    },
  };
}
