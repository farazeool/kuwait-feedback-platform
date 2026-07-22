import { z } from "zod";

export const alertConfigFormSchema = z.object({
  id: z.string().uuid().optional(),
  ruleType: z.enum(["satisfaction_threshold", "negative_feedback_threshold", "concern_frequency_threshold", "sudden_decline"]),
  thresholdValue: z.coerce.number().min(0).max(100),
  severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  deduplicationMinutes: z.coerce.number().int().min(0).default(60),
  isActive: z.enum(["true", "false"]).optional().default("true"),
  locationId: z.union([z.string().uuid(), z.literal("")]).optional().default(""),
});
