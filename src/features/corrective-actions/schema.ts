import { z } from "zod";

export const CorrectiveActionPriority = ["low", "medium", "high", "critical"] as const;
export type CorrectiveActionPriority = typeof CorrectiveActionPriority[number];

export const CorrectiveActionStatus = [
  "draft",
  "open",
  "in_progress",
  "pending_verification",
  "verified",
  "effectiveness_review",
  "closed",
  "rejected",
] as const;
export type CorrectiveActionStatus = typeof CorrectiveActionStatus[number];

export const VerificationStatus = [
  "pending",
  "accepted",
  "rejected",
  "more_evidence_required",
] as const;
export type VerificationStatus = typeof VerificationStatus[number];

export const EffectivenessResult = [
  "effective",
  "partially_effective",
  "not_effective",
] as const;
export type EffectivenessResult = typeof EffectivenessResult[number];

export const ClosureApproval = [
  "pending",
  "approved",
  "rejected",
] as const;
export type ClosureApproval = typeof ClosureApproval[number];

export const AttachmentFileType = [
  "photo",
  "pdf",
  "checklist",
  "training_record",
  "maintenance_record",
  "supplier_document",
  "other",
] as const;
export type AttachmentFileType = typeof AttachmentFileType[number];

export const correctiveActionFormSchema = z.object({
  problem: z.string().trim().min(1).max(5000),
  rootCause: z.string().trim().min(1).max(5000),
  actionDescription: z.string().trim().min(1).max(5000),
  priority: z.enum(CorrectiveActionPriority).default("medium"),
  status: z.enum(CorrectiveActionStatus).default("draft"),
  branchId: z.string().uuid().nullable().optional(),
  departmentId: z.string().uuid().nullable().optional(),
  sourceResponseId: z.string().uuid().nullable().optional(),
  relatedAlertId: z.string().uuid().nullable().optional(),
  controlledRecordReference: z.string().trim().max(200).nullable().optional(),
  dueDate: z.string().min(1, "Due date is required"),
  targetCompletionDate: z.string().min(1, "Target completion date is required"),
  assignedOwnerId: z.string().uuid(),
  verificationComments: z.string().trim().max(2000).nullable().optional(),
  effectivenessResult: z.enum(EffectivenessResult).nullable().optional(),
  effectivenessReviewDate: z.string().nullable().optional(),
  effectivenessReviewNotes: z.string().trim().max(2000).nullable().optional(),
  closureApproval: z.enum(ClosureApproval).nullable().optional(),
  internalNotes: z.string().trim().max(5000).nullable().optional(),
});

export type CorrectiveActionFormData = z.infer<typeof correctiveActionFormSchema>;

export const correctiveActionFilterSchema = z.object({
  q: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  branchId: z.string().optional(),
  departmentId: z.string().optional(),
  assignedOwnerId: z.string().optional(),
  dueDateFrom: z.string().optional(),
  dueDateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export const caCommentSchema = z.object({
  comment: z.string().trim().min(1).max(5000),
});

export type CACommentFormData = z.infer<typeof caCommentSchema>;