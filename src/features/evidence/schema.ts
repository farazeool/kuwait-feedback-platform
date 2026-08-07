import { z } from "zod";

export const EvidenceEntityType = [
  "corrective_action",
  "investigation",
  "response",
  "alert",
] as const;
export type EvidenceEntityType = typeof EvidenceEntityType[number];

export const EvidenceFileType = [
  "photo",
  "pdf",
  "checklist",
  "training_record",
  "maintenance_record",
  "supplier_document",
  "other",
] as const;
export type EvidenceFileType = typeof EvidenceFileType[number];

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

export const evidenceUploadSchema = z.object({
  entityType: z.enum(EvidenceEntityType),
  entityId: z.string().uuid(),
  fileName: z.string().trim().min(1).max(255),
  storagePath: z.string().trim().min(1).max(500),
  fileType: z.enum(EvidenceFileType),
  description: z.string().trim().max(2000).nullable().optional(),
});

export type EvidenceUploadData = z.infer<typeof evidenceUploadSchema>;

export const evidenceUpdateSchema = z.object({
  fileName: z.string().trim().min(1).max(255).optional(),
  fileType: z.enum(EvidenceFileType).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
});

export type EvidenceUpdateData = z.infer<typeof evidenceUpdateSchema>;

export const evidenceFilterSchema = z.object({
  q: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  fileType: z.string().optional(),
  verificationStatus: z.string().optional(),
  uploadedBy: z.string().optional(),
  uploadedFrom: z.string().optional(),
  uploadedTo: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export const verificationSchema = z.object({
  evidenceId: z.string().uuid(),
  status: z.enum(VerificationStatus),
  comments: z.string().trim().min(1, "Comments are required for verification").max(2000),
});

export type VerificationData = z.infer<typeof verificationSchema>;

export const effectivenessReviewSchema = z.object({
  correctiveActionId: z.string().uuid(),
  result: z.enum(EffectivenessResult),
  reviewDate: z.string().min(1, "Review date is required"),
  comments: z.string().trim().max(3000).nullable().optional(),
  followUpRequired: z.boolean().default(false),
  followUpNotes: z.string().trim().max(2000).nullable().optional(),
});

export type EffectivenessReviewData = z.infer<typeof effectivenessReviewSchema>;

export const effectivenessReviewFilterSchema = z.object({
  q: z.string().optional(),
  result: z.string().optional(),
  correctiveActionId: z.string().optional(),
  reviewerId: z.string().optional(),
  reviewDateFrom: z.string().optional(),
  reviewDateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export const closureApprovalSchema = z.object({
  correctiveActionId: z.string().uuid(),
  closureApproval: z.enum(ClosureApproval),
  comments: z.string().trim().max(2000).nullable().optional(),
});

export type ClosureApprovalData = z.infer<typeof closureApprovalSchema>;

export const evidenceFormSchema = z.object({
  entityType: z.enum(EvidenceEntityType),
  entityId: z.string().uuid(),
  fileName: z.string().trim().min(1).max(255),
  storagePath: z.string().trim().min(1).max(500),
  fileType: z.enum(EvidenceFileType),
  description: z.string().trim().max(2000).nullable().optional(),
});

export type EvidenceFormData = z.infer<typeof evidenceFormSchema>;