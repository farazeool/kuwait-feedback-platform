import { z } from "zod";

export const DISTRIBUTION_CHANNELS = [
  "email", "qr", "walk_in", "kiosk", "website", "web",
  "phone", "whatsapp", "tablet", "sms",
] as const;
export type DistributionChannel = (typeof DISTRIBUTION_CHANNELS)[number];

export const ASSIGNMENT_TARGETS = ["employee", "location", "touchpoint"] as const;
export type AssignmentTarget = (typeof ASSIGNMENT_TARGETS)[number];

export const distributionTemplateSchema = z.object({
  channel: z.enum(DISTRIBUTION_CHANNELS),
  templateName: z.string().trim().min(1).max(200),
  description: z.string().trim().max(500).optional().default(""),
  isDefault: z.boolean().optional().default(false),
  config: z.record(z.string(), z.unknown()).optional().default({}),
  renderConfig: z.record(z.string(), z.unknown()).optional().default({}),
});

export type DistributionTemplateInput = z.infer<typeof distributionTemplateSchema>;

export const distributionAssignmentSchema = z.object({
  templateId: z.string().uuid(),
  surveyId: z.string().uuid(),
  campaignId: z.string().uuid().nullable().optional(),
  targetType: z.enum(ASSIGNMENT_TARGETS),
  targetId: z.string().uuid(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
  expiresAt: z.string().datetime().nullable().optional(),
});

export type DistributionAssignmentInput = z.infer<typeof distributionAssignmentSchema>;

export const emailRenderConfigSchema = z.object({
  ratingStyle: z.enum(["emoji", "star", "three_option", "yes_no"]).default("emoji"),
  headingEn: z.string().max(200).default("How was your experience?"),
  headingAr: z.string().max(200).default("كيف كانت تجربتك؟"),
  descriptionEn: z.string().max(500).optional().default(""),
  descriptionAr: z.string().max(500).optional().default(""),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#2563eb"),
  iconSize: z.enum(["small", "medium", "large"]).default("medium"),
  alignment: z.enum(["left", "center", "right"]).default("left"),
  showBusinessName: z.boolean().default(true),
  showPrivacyNotice: z.boolean().default(false),
  privacyNoticeEn: z.string().max(300).optional().default(""),
  privacyNoticeAr: z.string().max(300).optional().default(""),
  layout: z.enum(["horizontal", "vertical", "minimal", "branded"]).default("horizontal"),
});

export type EmailRenderConfig = z.infer<typeof emailRenderConfigSchema>;

export interface DistributionAnalytics {
  total_assignments: number;
  active_assignments: number;
  total_clicks: number;
  total_conversions: number;
  click_to_conversion_rate: number | null;
  by_channel: Array<{ channel: string; count: number; clicks: number; conversions: number }>;
}
