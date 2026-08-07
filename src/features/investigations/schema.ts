import { z } from "zod";

export const InvestigationStatus = [
  "draft",
  "active",
  "waiting_verification",
  "closed",
] as const;
export type InvestigationStatus = typeof InvestigationStatus[number];

export const EscalationDecision = [
  "none",
  "quality_manager",
  "senior_management",
  "platform_admin",
] as const;
export type EscalationDecision = typeof EscalationDecision[number];

export const investigationFormSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).nullable().optional(),
  branchId: z.string().uuid(),
  departmentId: z.string().uuid().nullable().optional(),
  investigatedAt: z.string().min(1, "Investigation date is required"),
  investigatorId: z.string().uuid(),
  evidenceReviewed: z.string().trim().max(5000).nullable().optional(),
  repeatedComplaints: z.boolean().default(false),
  repeatedComplaintsNotes: z.string().trim().max(2000).nullable().optional(),
  rootCause: z.string().trim().max(5000).nullable().optional(),
  findings: z.string().trim().max(5000).nullable().optional(),
  recommendation: z.string().trim().max(5000).nullable().optional(),
  escalationDecision: z.enum(EscalationDecision).default("none"),
  status: z.enum(InvestigationStatus).default("draft"),
  controlledRecordReferences: z.array(z.string().max(200)).default([]),
  internalNotes: z.string().trim().max(5000).nullable().optional(),
});

export type InvestigationFormData = z.infer<typeof investigationFormSchema>;

export const investigationFilterSchema = z.object({
  q: z.string().optional(),
  status: z.string().optional(),
  branchId: z.string().optional(),
  departmentId: z.string().optional(),
  investigatorId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export const investigationCommentSchema = z.object({
  comment: z.string().trim().min(1).max(5000),
});

export type InvestigationCommentFormData = z.infer<typeof investigationCommentSchema>;
