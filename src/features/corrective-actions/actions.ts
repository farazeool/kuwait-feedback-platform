"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireAppAccessContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { correctiveActionFormSchema, caCommentSchema, type CorrectiveActionStatus } from "./schema";

export async function createCorrectiveAction(formData: FormData) {
  const context = await requireAppAccessContext();
  if (!context.organization) redirect("/dashboard?error=no_org");

  const parsed = correctiveActionFormSchema.safeParse({
    problem: formData.get("problem"),
    rootCause: formData.get("rootCause"),
    actionDescription: formData.get("actionDescription"),
    priority: formData.get("priority"),
    status: "draft",
    branchId: formData.get("branchId") || null,
    departmentId: formData.get("departmentId") || null,
    sourceResponseId: formData.get("sourceResponseId") || null,
    relatedAlertId: formData.get("relatedAlertId") || null,
    controlledRecordReference: formData.get("controlledRecordReference") || null,
    dueDate: formData.get("dueDate"),
    targetCompletionDate: formData.get("targetCompletionDate"),
    assignedOwnerId: formData.get("assignedOwnerId"),
    internalNotes: formData.get("internalNotes") || null,
  });

  if (!parsed.success) {
    const params = new URLSearchParams({ error: "validation", form: "corrective_action" });
    if (formData.get("sourceResponseId")) params.set("sourceResponseId", String(formData.get("sourceResponseId")));
    if (formData.get("relatedAlertId")) params.set("relatedAlertId", String(formData.get("relatedAlertId")));
    redirect(`/dashboard/corrective-actions/new?${params.toString()}`);
  }

  const supabase = await createSupabaseServerClient();
  const { data: action, error } = await supabase
    .from("corrective_actions")
    .insert({
      organization_id: context.organization.id,
      problem: parsed.data.problem,
      root_cause: parsed.data.rootCause,
      action_description: parsed.data.actionDescription,
      priority: parsed.data.priority,
      status: "draft" as const,
      branch_id: parsed.data.branchId,
      department_id: parsed.data.departmentId,
      source_response_id: parsed.data.sourceResponseId,
      related_alert_id: parsed.data.relatedAlertId,
      controlled_record_reference: parsed.data.controlledRecordReference,
      due_date: parsed.data.dueDate,
      target_completion_date: parsed.data.targetCompletionDate,
      assigned_owner_id: parsed.data.assignedOwnerId,
      created_by: context.user.id,
      internal_notes: parsed.data.internalNotes,
    })
    .select("id")
    .single();

  if (error || !action) redirect("/dashboard/corrective-actions?error=save_failed");

  revalidatePath("/dashboard/corrective-actions");
  redirect(`/dashboard/corrective-actions/${action.id}?created=1`);
}

export async function updateCorrectiveAction(formData: FormData) {
  const context = await requireAppAccessContext();
  if (!context.organization) redirect("/dashboard?error=no_org");

  const actionId = formData.get("actionId") as string;
  if (!actionId) redirect("/dashboard/corrective-actions?error=missing_id");

  const parsed = correctiveActionFormSchema.safeParse({
    problem: formData.get("problem"),
    rootCause: formData.get("rootCause"),
    actionDescription: formData.get("actionDescription"),
    priority: formData.get("priority"),
    status: formData.get("status") || "draft",
    branchId: formData.get("branchId") || null,
    departmentId: formData.get("departmentId") || null,
    sourceResponseId: formData.get("sourceResponseId") || null,
    relatedAlertId: formData.get("relatedAlertId") || null,
    controlledRecordReference: formData.get("controlledRecordReference") || null,
    dueDate: formData.get("dueDate"),
    targetCompletionDate: formData.get("targetCompletionDate"),
    assignedOwnerId: formData.get("assignedOwnerId"),
    internalNotes: formData.get("internalNotes") || null,
  });

  if (!parsed.success) {
    redirect(`/dashboard/corrective-actions/${actionId}?error=validation`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("corrective_actions")
    .update({
      problem: parsed.data.problem,
      root_cause: parsed.data.rootCause,
      action_description: parsed.data.actionDescription,
      priority: parsed.data.priority,
      status: parsed.data.status,
      branch_id: parsed.data.branchId,
      department_id: parsed.data.departmentId,
      controlled_record_reference: parsed.data.controlledRecordReference,
      due_date: parsed.data.dueDate,
      target_completion_date: parsed.data.targetCompletionDate,
      assigned_owner_id: parsed.data.assignedOwnerId,
      internal_notes: parsed.data.internalNotes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", actionId)
    .eq("organization_id", context.organization.id);

  if (error) redirect(`/dashboard/corrective-actions/${actionId}?error=update_failed`);

  revalidatePath("/dashboard/corrective-actions");
  revalidatePath(`/dashboard/corrective-actions/${actionId}`);
  redirect(`/dashboard/corrective-actions/${actionId}?updated=1`);
}

export async function updateCorrectiveActionStatus(formData: FormData) {
  const context = await requireAppAccessContext();
  if (!context.organization) redirect("/dashboard?error=no_org");

  const actionId = formData.get("actionId") as string;
  const newStatus = formData.get("status") as CorrectiveActionStatus;
  const reason = formData.get("reason") as string;

  if (!actionId || !newStatus) redirect("/dashboard/corrective-actions?error=missing_fields");

  const supabase = await createSupabaseServerClient();

  // Get current action with org validation
  const { data: currentAction } = await supabase
    .from("corrective_actions")
    .select("status, organization_id")
    .eq("id", actionId)
    .eq("organization_id", context.organization.id)
    .maybeSingle();

  if (!currentAction) redirect(`/dashboard/corrective-actions/${actionId}?error=not_found`);

  const now = new Date().toISOString();

  // Build update payload
  const payload: Record<string, unknown> = {
    status: newStatus,
    updated_at: now,
  };

  if (newStatus === "closed") {
    payload.closure_date = now;
    payload.closure_approval = "approved";
    payload.closure_approved_by = context.user.id;
    payload.closure_approved_at = now;
  } else if (newStatus === "pending_verification") {
    payload.completion_date = now;
  } else if (newStatus === "verified") {
    payload.verified_by = context.user.id;
    payload.verified_at = now;
  } else if (newStatus === "rejected") {
    payload.verification_status = "rejected";
  } else if (newStatus === "effectiveness_review") {
    payload.verification_status = "accepted";
  }

  const { error } = await supabase
    .from("corrective_actions")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(payload as any)
    .eq("id", actionId)
    .eq("organization_id", context.organization.id);

  if (error) redirect(`/dashboard/corrective-actions/${actionId}?error=status_update_failed`);

  // Record status history
  await supabase.from("corrective_action_status_history").insert({
    corrective_action_id: actionId,
    organization_id: context.organization.id,
    previous_status: currentAction.status,
    new_status: newStatus,
    changed_by: context.user.id,
    change_reason: reason || null,
  });

  revalidatePath("/dashboard/corrective-actions");
  revalidatePath(`/dashboard/corrective-actions/${actionId}`);
  redirect(`/dashboard/corrective-actions/${actionId}?updated=1`);
}

export async function addCorrectiveActionComment(formData: FormData) {
  const context = await requireAppAccessContext();
  if (!context.organization) redirect("/dashboard?error=no_org");

  const actionId = formData.get("actionId") as string;
  const commentText = formData.get("comment") as string;

  if (!actionId || !commentText?.trim()) redirect(`/dashboard/corrective-actions/${actionId}?error=missing_comment`);

  const parsed = caCommentSchema.safeParse({ comment: commentText });
  if (!parsed.success) redirect(`/dashboard/corrective-actions/${actionId}?error=invalid_comment`);

  const supabase = await createSupabaseServerClient();

  // Verify the corrective action belongs to this org before adding a comment
  const { data: validAction } = await supabase
    .from("corrective_actions")
    .select("id")
    .eq("id", actionId)
    .eq("organization_id", context.organization.id)
    .maybeSingle();

  if (!validAction) redirect(`/dashboard/corrective-actions/${actionId}?error=not_found`);

  const { error } = await supabase.from("corrective_action_comments").insert({
    corrective_action_id: actionId,
    organization_id: context.organization.id,
    author_id: context.user.id,
    comment: parsed.data.comment,
  });

  if (error) redirect(`/dashboard/corrective-actions/${actionId}?error=comment_failed`);

  revalidatePath(`/dashboard/corrective-actions/${actionId}`);
  redirect(`/dashboard/corrective-actions/${actionId}?commented=1`);
}

export async function deleteCorrectiveAction(formData: FormData) {
  const context = await requireAppAccessContext();
  if (!context.organization || context.profile.platformRole !== "platform_admin") {
    redirect("/dashboard?error=unauthorized");
  }

  const actionId = formData.get("actionId") as string;
  if (!actionId) redirect("/dashboard/corrective-actions?error=missing_id");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("corrective_actions")
    .delete()
    .eq("id", actionId)
    .eq("organization_id", context.organization.id);

  if (error) redirect("/dashboard/corrective-actions?error=delete_failed");

  revalidatePath("/dashboard/corrective-actions");
  redirect("/dashboard/corrective-actions?deleted=1");
}