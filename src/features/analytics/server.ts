import "server-only";

import { notFound } from "next/navigation";

import { resolveAnalyticsRange } from "./dates";
import { analyticsFiltersSchema, analyticsOverviewSchema, questionAnalyticsSchema } from "./schema";
import { requireAppAccessContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getAnalyticsDashboard(rawFilters: Record<string, string | undefined>) {
  const context = await requireAppAccessContext();
  const filters = analyticsFiltersSchema.parse(rawFilters);
  const range = resolveAnalyticsRange(filters);
  const supabase = await createSupabaseServerClient();
  const { data: organizations } = await supabase.from("organizations").select("id, name_en, name_ar").eq("status", "active").order("name_en");
  const organizationId = organizations?.some((row) => row.id === filters.organization)
    ? filters.organization!
    : context.organization?.id ?? organizations?.[0]?.id;
  if (!organizationId) return { context, filters, range, organizations: [], locations: [], surveys: [], overview: null, canCompareLocations: false };

  const [{ data: locations }, { data: surveys }, { data: membership }] = await Promise.all([
    supabase.from("locations").select("id, name_en, name_ar").eq("organization_id", organizationId).eq("status", "active").order("name_en"),
    supabase.from("surveys").select("id, title_en, title_ar, status, location_id").eq("organization_id", organizationId).order("title_en"),
    supabase.from("organization_memberships").select("role, scope").eq("organization_id", organizationId).eq("user_id", context.user.id).eq("status", "active").maybeSingle(),
  ]);
  const locationId = locations?.some((row) => row.id === filters.location) ? filters.location : undefined;
  const surveyId = surveys?.some((row) => row.id === filters.survey) ? filters.survey : undefined;
  const { data, error } = await supabase.rpc("get_analytics_overview", {
    p_organization_id: organizationId,
    p_start_at: range.start,
    p_end_at: range.end,
    p_location_id: locationId,
    p_survey_id: surveyId,
    p_rating_min: filters.ratingMin,
    p_rating_max: filters.ratingMax,
    p_alert_status: filters.alertStatus,
    p_bucket: range.bucket,
  });
  if (error) throw new Error("Unable to load permission-scoped analytics");
  return {
    context,
    filters: { ...filters, organization: organizationId, location: locationId, survey: surveyId },
    range,
    organizations: organizations ?? [],
    locations: locations ?? [],
    surveys: surveys ?? [],
    overview: analyticsOverviewSchema.parse(data),
    canCompareLocations: context.profile.platformRole === "platform_admin" || membership?.role !== "location_manager",
  };
}

export async function getSurveyAnalytics(surveyId: string, rawFilters: Record<string, string | undefined>) {
  await requireAppAccessContext();
  const filters = analyticsFiltersSchema.parse(rawFilters);
  const range = resolveAnalyticsRange(filters);
  const supabase = await createSupabaseServerClient();
  const { data: survey } = await supabase.from("surveys").select("id, title_en, title_ar, status, organization_id, location_id").eq("id", surveyId).maybeSingle();
  if (!survey) notFound();
  const textPage = Math.min(500, Math.max(1, Number.parseInt(rawFilters.textPage ?? "1", 10) || 1));
  const textPageSize = 20;
  const { data, error } = await supabase.rpc("get_survey_question_analytics", {
    p_survey_id: surveyId,
    p_start_at: range.start,
    p_end_at: range.end,
    p_text_limit: textPageSize,
    p_text_offset: (textPage - 1) * textPageSize,
  });
  if (error) throw new Error("Unable to load survey analytics");
  return { survey, range, filters, questions: questionAnalyticsSchema.parse(data), textPage, textPageSize };
}
