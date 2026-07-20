import { z } from "zod";

const nullableNumber = z.number().nullable();

export const analyticsFiltersSchema = z.object({
  preset: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  organization: z.string().uuid().optional(),
  location: z.string().uuid().optional(),
  survey: z.string().uuid().optional(),
  ratingMin: z.coerce.number().min(0).max(10).optional(),
  ratingMax: z.coerce.number().min(0).max(10).optional(),
  alertStatus: z.enum(["open", "acknowledged", "resolved", "dismissed"]).optional(),
});

export const exportFiltersSchema = analyticsFiltersSchema.extend({
  q: z.string().trim().max(200).optional(),
  rating: z.coerce.number().int().min(0).max(10).optional(),
  alert: z.enum(["open", "acknowledged", "resolved", "dismissed"]).optional(),
  workflow: z.enum(["unread", "reviewed", "action_required", "resolved"]).optional(),
  tag: z.string().trim().max(40).optional(),
  assignee: z.string().uuid().optional(),
  unresolved: z.enum(["1"]).optional(),
});

const comparisonSchema = z.object({
  id: z.string(),
  name_en: z.string().optional(),
  name_ar: z.string().optional(),
  title_en: z.string().optional(),
  title_ar: z.string().optional(),
  response_count: z.number(),
  average_normalized: nullableNumber,
  previous_count: z.number().optional(),
  previous_average_normalized: nullableNumber.optional(),
  change: nullableNumber.optional(),
  sufficient_data: z.boolean().optional(),
});

export const analyticsOverviewSchema = z.object({
  total_responses: z.number(),
  selected_responses: z.number(),
  average_normalized: nullableNumber,
  low_score_count: z.number(),
  open_alert_count: z.number(),
  rating_scales: z.array(z.object({ min: z.number(), max: z.number() })),
  rating_distribution: z.array(z.object({ band: z.number(), count: z.number() })),
  response_trend: z.array(z.object({ period: z.string(), count: z.number() })),
  low_score_trend: z.array(z.object({ period: z.string(), count: z.number() })),
  location_comparison: z.array(comparisonSchema),
  survey_comparison: z.array(comparisonSchema),
  alert_metrics: z.array(z.object({ status: z.string(), count: z.number() })),
  recent_responses: z.array(z.object({
    id: z.string().uuid(),
    submitted_at: z.string(),
    rating: nullableNumber,
    normalized_rating: nullableNumber,
    survey_title: z.string(),
    location_name: z.string(),
    workflow_status: z.string(),
  })),
});

export const questionAnalyticsSchema = z.array(z.object({
  id: z.string().uuid(),
  type: z.enum(["rating", "multiple_choice", "text"]),
  label_en: z.string(),
  label_ar: z.string(),
  response_count: z.number(),
  rating: z.object({
    average: nullableNumber,
    median: nullableNumber,
    min: z.number(),
    max: z.number(),
    distribution: z.array(z.object({ value: z.number(), count: z.number() })),
    trend: z.array(z.object({ period: z.string(), average: z.number() })),
  }).nullable(),
  options: z.array(z.object({
    id: z.string().uuid(), label_en: z.string(), label_ar: z.string(), count: z.number(), percentage: z.number(),
  })).nullable(),
  recent_text_answers: z.array(z.object({ response_id: z.string().uuid(), text: z.string(), submitted_at: z.string() })).nullable(),
}));

export type AnalyticsFilters = z.infer<typeof analyticsFiltersSchema>;
export type AnalyticsOverview = z.infer<typeof analyticsOverviewSchema>;
