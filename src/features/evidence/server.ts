import "server-only";

import { notFound } from "next/navigation";

import { getAppAccessContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { EvidenceEntityType, EvidenceFileType, VerificationStatus, EffectivenessResult } from "./schema";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface EvidenceRow {
  id: string;
  organization_id: string;
  entity_type: EvidenceEntityType;
  entity_id: string;
  file_name: string;
  storage_path: string;
  file_type: EvidenceFileType;
  description: string | null;
  uploaded_by: string;
  uploaded_at: string;
  verification_status: VerificationStatus;
  verified_by: string | null;
  verified_at: string | null;
  verification_comments: string | null;
  created_at: string;
  updated_at: string;
  uploader: { display_name: string; email: string } | null;
  verifier: { display_name: string; email: string } | null;
}

export interface VerificationRow {
  id: string;
  evidence_id: string;
  organization_id: string;
  verifier_id: string;
  status: VerificationStatus;
  comments: string | null;
  verified_at: string;
  created_at: string;
  verifier: { display_name: string; email: string } | null;
}

export interface EffectivenessReviewRow {
  id: string;
  corrective_action_id: string;
  organization_id: string;
  reviewer_id: string;
  result: EffectivenessResult;
  review_date: string;
  comments: string | null;
  follow_up_required: boolean;
  follow_up_notes: string | null;
  created_at: string;
  updated_at: string;
  reviewer: { display_name: string; email: string } | null;
}

export async function listEvidence(filters: {
  q?: string;
  entityType?: string;
  entityId?: string;
  fileType?: string;
  verificationStatus?: string;
  uploadedBy?: string;
  uploadedFrom?: string;
  uploadedTo?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  const context = await getAppAccessContext();
  if (!context) throw new Error("Authentication required");

  const supabase = await createSupabaseServerClient();
  if (!context.organization) return { context, rows: [] as EvidenceRow[], pageCount: 0, totalCount: 0 };

  const orgId = context.organization.id;
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;

  let query = supabase
    .from("evidence")
    .select("*, uploader:profiles!uploaded_by(display_name), verifier:profiles!verified_by(display_name)", { count: "exact" } as any)
    .eq("organization_id", orgId)
    .order("uploaded_at", { ascending: false });

  if (filters.q?.trim()) {
    query = query.or(`file_name.ilike.%${filters.q}%,description.ilike.%${filters.q}%`);
  }
  if (filters.entityType) query = query.eq("entity_type", filters.entityType as EvidenceEntityType);
  if (filters.entityId) query = query.eq("entity_id", filters.entityId);
  if (filters.fileType) query = query.eq("file_type", filters.fileType as EvidenceFileType);
  if (filters.verificationStatus) query = query.eq("verification_status", filters.verificationStatus as VerificationStatus);
  if (filters.uploadedBy) query = query.eq("uploaded_by", filters.uploadedBy);
  if (filters.uploadedFrom) query = query.gte("uploaded_at", filters.uploadedFrom);
  if (filters.uploadedTo) query = query.lte("uploaded_at", filters.uploadedTo);

  query = query.range((page - 1) * pageSize, page * pageSize - 1);

  const { data, error, count } = await query;
  if (error) {
    const message = [
      `code=${error.code ?? "unknown"}`,
      `message=${error.message ?? "unknown"}`,
      `details=${error.details ?? "none"}`,
      `hint=${error.hint ?? "none"}`
    ].join(" | ");

    console.error("listEvidence failed:", message);
    throw new Error(message);
  }

  return {
    context,
    rows: (data ?? []) as unknown as EvidenceRow[],
    pageCount: Math.ceil((count ?? 0) / pageSize),
    totalCount: count ?? 0,
  };
}

export async function getEvidence(evidenceId: string) {
  const context = await getAppAccessContext();
  if (!context) throw new Error("Authentication required");

  const supabase = await createSupabaseServerClient();
  if (!context.organization) notFound();

  const { data: evidence, error } = await supabase
    .from("evidence")
    .select("*, uploader:profiles!uploaded_by(display_name), verifier:profiles!verified_by(display_name)")
    .eq("id", evidenceId)
    .maybeSingle();

  if (error || !evidence) notFound();

  // Verify organization access
  if (evidence.organization_id !== context.organization.id) notFound();

  // Fetch verification history
  const { data: verifications } = await supabase
    .from("verification")
    .select("*, verifier:profiles!verifier_id(display_name)")
    .eq("evidence_id", evidenceId)
    .order("verified_at", { ascending: false });

  // Fetch entity context
  let entityLabel = "Unknown";
  if (evidence.entity_type === "corrective_action") {
    const { data: ca } = await supabase
      .from("corrective_actions")
      .select("problem")
      .eq("id", evidence.entity_id)
      .maybeSingle();
    if (ca) entityLabel = ca.problem.slice(0, 100);
  } else if (evidence.entity_type === "investigation") {
    const { data: inv } = await supabase
      .from("investigations")
      .select("title")
      .eq("id", evidence.entity_id)
      .maybeSingle();
    if (inv) entityLabel = inv.title;
  } else if (evidence.entity_type === "alert") {
    const { data: alert } = await supabase
      .from("alerts")
      .select("message")
      .eq("id", evidence.entity_id)
      .maybeSingle();
    if (alert) entityLabel = alert.message?.slice(0, 100) ?? "Alert";
  } else if (evidence.entity_type === "response") {
    const { data: resp } = await supabase
      .from("survey_responses")
      .select("id")
      .eq("id", evidence.entity_id)
      .maybeSingle();
    if (resp) entityLabel = `Response #${resp.id.slice(0, 8)}`;
  }

  return {
    context,
    evidence: evidence as unknown as EvidenceRow,
    verifications: (verifications ?? []) as unknown as VerificationRow[],
    entityLabel,
  };
}

export async function getEvidenceForEntity(entityType: string, entityId: string) {
  const context = await getAppAccessContext();
  if (!context) throw new Error("Authentication required");

  const supabase = await createSupabaseServerClient();
  if (!context.organization) return [];

  const { data } = await supabase
    .from("evidence")
    .select("*, uploader:profiles!uploaded_by(display_name), verifier:profiles!verified_by(display_name)")
    .eq("organization_id", context.organization.id)
    .eq("entity_type", entityType as EvidenceEntityType)
    .eq("entity_id", entityId)
    .order("uploaded_at", { ascending: false });

  return (data ?? []) as unknown as EvidenceRow[];
}

export async function getVerificationHistory(evidenceId: string) {
  const context = await getAppAccessContext();
  if (!context) throw new Error("Authentication required");

  const supabase = await createSupabaseServerClient();
  if (!context.organization) return [];

  const { data } = await supabase
    .from("verification")
    .select("*, verifier:profiles!verifier_id(display_name)")
    .eq("evidence_id", evidenceId)
    .order("verified_at", { ascending: false });

  return (data ?? []) as unknown as VerificationRow[];
}

export async function getEffectivenessReview(reviewId: string) {
  const context = await getAppAccessContext();
  if (!context) throw new Error("Authentication required");

  const supabase = await createSupabaseServerClient();
  if (!context.organization) notFound();

  const { data: review, error } = await supabase
    .from("effectiveness_review")
    .select("*, reviewer:profiles!reviewer_id(display_name)")
    .eq("id", reviewId)
    .maybeSingle();

  if (error || !review) notFound();

  if (review.organization_id !== context.organization.id) notFound();

  return {
    context,
    review: review as unknown as EffectivenessReviewRow,
  };
}

export async function listEffectivenessReviews(filters: {
  q?: string;
  result?: string;
  correctiveActionId?: string;
  reviewerId?: string;
  reviewDateFrom?: string;
  reviewDateTo?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  const context = await getAppAccessContext();
  if (!context) throw new Error("Authentication required");

  const supabase = await createSupabaseServerClient();
  if (!context.organization) return { context, rows: [] as EffectivenessReviewRow[], pageCount: 0, totalCount: 0 };

  const orgId = context.organization.id;
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;

  let query = supabase
    .from("effectiveness_review")
    .select("*, reviewer:profiles!reviewer_id(display_name)", { count: "exact" } as any)
    .eq("organization_id", orgId)
    .order("review_date", { ascending: false });

  if (filters.q?.trim()) {
    query = query.or(`comments.ilike.%${filters.q}%,follow_up_notes.ilike.%${filters.q}%`);
  }
  if (filters.result) query = query.eq("result", filters.result as EffectivenessResult);
  if (filters.correctiveActionId) query = query.eq("corrective_action_id", filters.correctiveActionId);
  if (filters.reviewerId) query = query.eq("reviewer_id", filters.reviewerId);
  if (filters.reviewDateFrom) query = query.gte("review_date", filters.reviewDateFrom);
  if (filters.reviewDateTo) query = query.lte("review_date", filters.reviewDateTo);

  query = query.range((page - 1) * pageSize, page * pageSize - 1);

  const { data, error, count } = await query;
  if (error) {
    const message = [
      `code=${error.code ?? "unknown"}`,
      `message=${error.message ?? "unknown"}`,
      `details=${error.details ?? "none"}`,
      `hint=${error.hint ?? "none"}`
    ].join(" | ");

    console.error("listEffectivenessReviews failed:", message);
    throw new Error(message);
  }

  return {
    context,
    rows: (data ?? []) as unknown as EffectivenessReviewRow[],
    pageCount: Math.ceil((count ?? 0) / pageSize),
    totalCount: count ?? 0,
  };
}

export async function getEffectivenessReviewsForAction(correctiveActionId: string) {
  const context = await getAppAccessContext();
  if (!context) throw new Error("Authentication required");

  const supabase = await createSupabaseServerClient();
  if (!context.organization) return [];

  const { data } = await supabase
    .from("effectiveness_review")
    .select("*, reviewer:profiles!reviewer_id(display_name)")
    .eq("organization_id", context.organization.id)
    .eq("corrective_action_id", correctiveActionId)
    .order("review_date", { ascending: false });

  return (data ?? []) as unknown as EffectivenessReviewRow[];
}

export async function getFilterOptions() {
  const context = await getAppAccessContext();
  if (!context) throw new Error("Authentication required");

  const supabase = await createSupabaseServerClient();
  if (!context.organization) return { users: [] as { id: string; display_name: string }[], correctiveActions: [] as { id: string; problem: string }[] };

  const orgId = context.organization.id;

  const [{ data: memberships }, { data: actions }] = await Promise.all([
    supabase.from("organization_memberships").select("user_id").eq("organization_id", orgId).eq("status", "active"),
    supabase.from("corrective_actions").select("id, problem").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(100),
  ]);

  const userIds = (memberships ?? []).map((m) => m.user_id).filter(Boolean);
  const { data: users } = userIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", userIds).order("display_name")
    : { data: [] };

  return {
    users: users ?? [],
    correctiveActions: actions ?? [],
  };
}
