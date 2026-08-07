import { z } from "zod";

export const escalationRuleSchema = z.object({
  surveyId: z.string().uuid().nullable().optional(),
  locationId: z.string().uuid().nullable().optional(),
  triggerType: z.enum(["rating_threshold", "keywords", "negative_sentiment"]),
  thresholdValue: z.number().int().min(1).max(5).optional(),
  keywords: z.array(z.string().max(50)).max(20).optional(),
  autoCreateAlert: z.boolean().default(true),
  autoAssignInvestigation: z.boolean().default(false),
  autoNotifyManager: z.boolean().default(false),
  severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
});

export type EscalationRuleInput = z.infer<typeof escalationRuleSchema>;
