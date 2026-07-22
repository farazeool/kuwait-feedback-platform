import { z } from "zod";

export const alertConfigFormSchema = z.object({
  id: z.string().uuid().optional(),
  ruleType: z.enum(["satisfaction_threshold", "negative_feedback_threshold", "concern_frequency_threshold", "sudden_decline"]),
  thresholdValue: z.coerce.number().min(0).max(100),
  severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  deduplicationMinutes: z.coerce.number().int().min(0).default(60),
  evaluationWindowHours: z.coerce.number().int().min(1).max(168).default(24).optional(),
  comparisonWindowDays: z.coerce.number().int().min(1).max(30).default(7).optional(),
  minimumSampleCount: z.coerce.number().int().min(1).max(100).default(5).optional(),
  isActive: z.enum(["true", "false"]).optional().default("true"),
  locationId: z.union([z.string().uuid(), z.literal("")]).optional().default(""),
});