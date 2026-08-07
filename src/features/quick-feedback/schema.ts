import { z } from "zod";

export const quickFeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  categories: z.array(z.string()).max(6).optional(),
  comment: z.string().max(1000).optional(),
});

export type QuickFeedback = z.infer<typeof quickFeedbackSchema>;

// Quick feedback survey-level configuration schema
export const quickFeedbackConfigSchema = z.object({
  surveyId: z.string().uuid(),
  isEnabled: z.boolean(),
  ratingStyle: z.enum(["emoji", "star", "numeric"]).default("emoji"),
  positiveThreshold: z.number().int().min(1).max(5).default(4),
  negativeThreshold: z.number().int().min(1).max(5).default(3),
  followUpEnabled: z.boolean().default(true),
  showCommentField: z.boolean().default(true),
}).refine((data) => data.negativeThreshold < data.positiveThreshold, {
  message: "Negative threshold must be less than positive threshold",
  path: ["negativeThreshold"],
});

export type QuickFeedbackConfig = z.infer<typeof quickFeedbackConfigSchema>;

// Pre-loaded quick feedback configuration from the survey for the public form
export const publicQuickFeedbackConfigSchema = z.object({
  is_enabled: z.boolean(),
  rating_style: z.enum(["emoji", "star", "numeric"]),
  positive_threshold: z.number().int().min(1).max(5),
  negative_threshold: z.number().int().min(1).max(5),
  follow_up_enabled: z.boolean().optional().default(true),
  show_comment_field: z.boolean().optional().default(true),
});

export type PublicQuickFeedbackConfig = z.infer<typeof publicQuickFeedbackConfigSchema>;
