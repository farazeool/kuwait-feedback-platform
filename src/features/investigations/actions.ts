"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireAppAccessContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { investigationFormSchema, investigationCommentSchema, type InvestigationStatus } from "./schema";

export async function createInvestigation(formData: FormData) {
  const context = await requireAppAccessContext();
  if (!context.organization) redirect("/dashboard?error=no_org");

  const parsed = investigationFormSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || null,
    branchId: formData.get("branchId"),
    departmentId: formData.get("departmentId") || null,
    investigatedAt: formData.get("investigatedAt"),
    investigatorId: formData.get("investigatorId"),
    evidenceReviewed: formData.get("evidenceReviewed") || null,
    repeatedComplaints: formData.get("repeatedComplaints") === "true",
    repeatedComplaintsNotes: formData.get("repeatedComplaintsNotes") || null,
    rootCause: formData.get("rootCause") || null,
    findings: formData.get("findings") || null,
    recommendation: formData.get("recommendation") || null,
    escalationDecision: (formData.get("escalationDecision") as string) || "none",
    status: "draft",
    controlledRecordReferences: [],
    internalNotes: formData.get("internalNotes") || null,
  });

  if (!parsed.success) {
    redirect("/dashboard/investigations/new?error=validation");
  }

  const supabase = await createSupabaseServerClient();
  const { data: investigation, error } = await supabase
    .from("investigations")
    .insert({
      organization_id: context.organization.id,
      title: parsed.data.title,
      description: parsed.data.description,
      branch_id: parsed.data.branchId,
      department_id: parsed.data.departmentId,
      investigated_at: parsed.data.investigatedAt,
      investigator_id: parsed.data.investigatorId,
      created_by: context.user.id,
      evidence_reviewed: parsed.data.evidenceReviewed,
      repeated_complaints: parsed.data.repeatedComplaints,
      repeated_complaints_notes: parsed.data.repeatedComplaintsNotes,
      root_cause: parsed.data.rootCause,
      findings: parsed.data.findings,
      recommendation: parsed.data.recommendation,
      escalation_decision: parsed.data.escalationDecision,
      status: "draft" as const,
      controlled_record_references: [],
      temperature_records: [],
      receiving_records: [],
      inspection_records: [],
      supplier_information: {},
      timeline: [],
      internal_notes: parsed.data.internalNotes,
    })
    .select("id")
    .single();

  if (error || !investigation) redirect("/dashboard/investigations?error=save_failed");

  revalidatePath("/dashboard/investigations");
  redirect(`/dashboard/investigations/${investigation.id}?created=1`);
}

export async function updateInvestigation(formData: FormData) {
  const context = await requireAppAccessContext();
  if (!context.organization) redirect("/dashboard?error=no_org");

  const investigationId = formData.get("investigationId") as string;
  if (!investigationId) redirect("/dashboard/investigations?error=missing_id");

  const parsed = investigationFormSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || null,
    branchId: formData.get("branchId"),
    departmentId: formData.get("departmentId") || null,
    investigatedAt: formData.get("investigatedAt"),
    investigatorId: formData.get("investigatorId"),
    evidenceReviewed: formData.get("evidenceReviewed") || null,
    repeatedComplaints: formData.get("repeatedComplaints") === "true",
    repeatedComplaintsNotes: formData.get("repeatedComplaintsNotes") || null,
    rootCause: formData.get("rootCause") || null,
    findings: formData.get("findings") || null,
    recommendation: formData.get("recommendation") || null,
    escalationDecision: (formData.get("escalationDecision") as string) || "none",
    status: (formData.get("status") as string) || "draft",
    controlledRecordReferences: [],
    internalNotes: formData.get("internalNotes") || null,
  });

  if (!parsed.success) {
    redirect(`/dashboard/investigations/${investigationId}?error=validation`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("investigations")
    .update({
      title: parsed.data.title,
      description: parsed.data.description,
      branch_id: parsed.data.branchId,
      department_id: parsed.data.departmentId,
      investigated_at: parsed.data.investigatedAt,
      investigator_id: parsed.data.investigatorId,
      evidence_reviewed: parsed.data.evidenceReviewed,
      repeated_complaints: parsed.data.repeatedComplaints,
      repeated_complaints_notes: parsed.data.repeatedComplaintsNotes,
      root_cause: parsed.data.rootCause,
      findings: parsed.data.findings,
      recommendation: parsed.data.recommendation,
      escalation_decision: parsed.data.escalationDecision,
      status: parsed.data.status,
      internal_notes: parsed.data.internalNotes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", investigationId)
    .eq("organization_id", context.organization.id);

  if (error) redirect(`/dashboard/investigations/${investigationId}?error=update_failed`);

  revalidatePath("/dashboard/investigations");
  revalidatePath(`/dashboard/investigations/${investigationId}`);
  redirect(`/dashboard/investigations/${investigationId}?updated=1`);
}

export async function updateInvestigationStatus(formData: FormData) {
  const context = await requireAppAccessContext();
  if (!context.organization) redirect("/dashboard?error=no_org");

  const investigationId = formData.get("investigationId") as string;
  const newStatus = formData.get("status") as InvestigationStatus;
  const reason = formData.get("reason") as string;

  if (!investigationId || !newStatus) redirect("/dashboard/investigations?error=missing_fields");

  const supabase = await createSupabaseServerClient();

  // Get current investigation scoped to user's org
  const { data: current } = await supabase
    .from("investigations")
    .select("status, organization_id")
    .eq("id", investigationId)
    .eq("organization_id", context.organization.id)
    .maybeSingle();

  if (!current) redirect(`/dashboard/investigations/${investigationId}?error=not_found`);

  const now = new Date().toISOString();

  // Build update payload
  const payload: Record<string, unknown> = {
    status: newStatus,
    updated_at: now,
  };

  if (newStatus === "closed") {
    payload.closed_at = now;
  } else {
    payload.closed_at = null;
  }

  const { error } = await supabase
    .from("investigations")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(payload as any)
    .eq("id", investigationId)
    .eq("organization_id", context.organization.id);

  if (error) redirect(`/dashboard/investigations/${investigationId}?error=status_update_failed`);

  // Record status history
  await supabase.from("investigation_status_history").insert({
    investigation_id: investigationId,
    organization_id: context.organization.id,
    previous_status: current.status,
    new_status: newStatus,
    changed_by: context.user.id,
    change_reason: reason || null,
  });

  revalidatePath("/dashboard/investigations");
  revalidatePath(`/dashboard/investigations/${investigationId}`);
  redirect(`/dashboard/investigations/${investigationId}?updated=1`);
}

export async function addComment(formData: FormData) {
  const context = await requireAppAccessContext();
  if (!context.organization) redirect("/dashboard?error=no_org");

  const investigationId = formData.get("investigationId") as string;
  const commentText = formData.get("comment") as string;

  if (!investigationId || !commentText?.trim()) redirect(`/dashboard/investigations/${investigationId}?error=missing_comment`);

  const parsed = investigationCommentSchema.safeParse({ comment: commentText });
  if (!parsed.success) redirect(`/dashboard/investigations/${investigationId}?error=invalid_comment`);

  const supabase = await createSupabaseServerClient();

  // Verify the investigation exists and belongs to this org
  const { data: validInvestigation } = await supabase
    .from("investigations")
    .select("id")
    .eq("id", investigationId)
    .eq("organization_id", context.organization.id)
    .maybeSingle();

  if (!validInvestigation) redirect(`/dashboard/investigations/${investigationId}?error=not_found`);

  const { error } = await supabase.from("investigation_comments").insert({
    investigation_id: investigationId,
    organization_id: context.organization.id,
    author_id: context.user.id,
    comment: parsed.data.comment,
    event_type: "comment",
  });

  if (error) redirect(`/dashboard/investigations/${investigationId}?error=comment_failed`);

  revalidatePath(`/dashboard/investigations/${investigationId}`);
  redirect(`/dashboard/investigations/${investigationId}?commented=1`);
}

export async function deleteInvestigation(formData: FormData) {
  const context = await requireAppAccessContext();
  if (!context.organization || context.profile.platformRole !== "platform_admin") {
    redirect("/dashboard?error=unauthorized");
  }

  const investigationId = formData.get("investigationId") as string;
  if (!investigationId) redirect("/dashboard/investigations?error=missing_id");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("investigations")
    .delete()
    .eq("id", investigationId)
    .eq("organization_id", context.organization.id);

  if (error) redirect("/dashboard/investigations?error=delete_failed");

  revalidatePath("/dashboard/investigations");
  redirect("/dashboard/investigations?deleted=1");
}