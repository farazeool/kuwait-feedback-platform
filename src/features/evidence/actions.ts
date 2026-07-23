"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireAppAccessContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  evidenceUploadSchema,
  evidenceUpdateSchema,
  verificationSchema,
  effectivenessReviewSchema,
  closureApprovalSchema,
  type EvidenceFileType,
  type EvidenceEntityType,
  type VerificationStatus,
} from "./schema";

export async function uploadEvidence(formData: FormData) {
  const context = await requireAppAccessContext();
  if (!context.organization) redirect("/dashboard?error=no_org");

  const parsed = evidenceUploadSchema.safeParse({
    entityType: formData.get("entityType"),
    entityId: formData.get("entityId"),
    fileName: formData.get("fileName"),
    storagePath: formData.get("storagePath"),
    fileType: formData.get("fileType"),
    description: formData.get("description") || null,
  });

  if (!parsed.success) {
    const params = new URLSearchParams({ error: "validation" });
    if (formData.get("entityId")) params.set("entityId", String(formData.get("entityId")));
    if (formData.get("entityType")) params.set("entityType", String(formData.get("entityType")));
    redirect(`/dashboard/evidence/new?${params.toString()}`);
  }

  const supabase = await createSupabaseServerClient();
  const { data: evidence, error } = await supabase
    .from("evidence")
    .insert({
      organization_id: context.organization.id,
      entity_type: parsed.data.entityType,
      entity_id: parsed.data.entityId,
      file_name: parsed.data.fileName,
      storage_path: parsed.data.storagePath,
      file_type: parsed.data.fileType,
      description: parsed.data.description ?? null,
      uploaded_by: context.user.id,
    })
    .select("id")
    .single();

  if (error || !evidence) redirect("/dashboard/evidence?error=upload_failed");

  revalidatePath("/dashboard/evidence");
  revalidatePath("/dashboard/corrective-actions");
  revalidatePath("/dashboard/investigations");

  // Redirect based on entity context
  const returnTo = formData.get("returnTo") as string;
  if (returnTo) {
    redirect(`${returnTo}?evidence_uploaded=1`);
  }
  redirect(`/dashboard/evidence/${evidence.id}?created=1`);
}

export async function updateEvidence(formData: FormData) {
  const context = await requireAppAccessContext();
  if (!context.organization) redirect("/dashboard?error=no_org");

  const evidenceId = formData.get("evidenceId") as string;
  if (!evidenceId) redirect("/dashboard/evidence?error=missing_id");

  const parsed = evidenceUpdateSchema.safeParse({
    fileName: formData.get("fileName") || undefined,
    fileType: formData.get("fileType") || undefined,
    description: formData.get("description") === "" ? null : formData.get("description"),
  });

  if (!parsed.success) {
    redirect(`/dashboard/evidence/${evidenceId}?error=validation`);
  }

  const supabase = await createSupabaseServerClient();
  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (parsed.data.fileName) updatePayload.file_name = parsed.data.fileName;
  if (parsed.data.fileType) updatePayload.file_type = parsed.data.fileType as EvidenceFileType;
   
  if (parsed.data.description !== undefined) updatePayload.description = parsed.data.description;

  const { error } = await supabase
    .from("evidence")
    .update(updatePayload as any)
    .eq("id", evidenceId)
    .eq("organization_id", context.organization.id);

  if (error) redirect(`/dashboard/evidence/${evidenceId}?error=update_failed`);

  revalidatePath("/dashboard/evidence");
  revalidatePath(`/dashboard/evidence/${evidenceId}`);
  redirect(`/dashboard/evidence/${evidenceId}?updated=1`);
}

export async function verifyEvidence(formData: FormData) {
  const context = await requireAppAccessContext();
  if (!context.organization) redirect("/dashboard?error=no_org");

  const evidenceId = formData.get("evidenceId") as string;
  const status = formData.get("status") as VerificationStatus;
  const comments = formData.get("comments") as string;

  if (!evidenceId || !status) redirect("/dashboard/evidence?error=missing_fields");

  const parsed = verificationSchema.safeParse({
    evidenceId,
    status,
    comments,
  });

  if (!parsed.success) {
    redirect(`/dashboard/evidence/${evidenceId}?error=verification_validation`);
  }

  const supabase = await createSupabaseServerClient();

  // Get current evidence to verify org access
  const { data: currentEvidence } = await supabase
    .from("evidence")
    .select("organization_id, entity_type, entity_id")
    .eq("id", evidenceId)
    .maybeSingle();

  if (!currentEvidence) redirect(`/dashboard/evidence/${evidenceId}?error=not_found`);
  if (currentEvidence.organization_id !== context.organization.id) redirect("/dashboard/evidence?error=unauthorized");

  // Insert verification record (append-only audit trail)
  const { error: verifyError } = await supabase
    .from("verification")
    .insert({
      evidence_id: evidenceId,
      organization_id: context.organization.id,
      verifier_id: context.user.id,
      status: parsed.data.status,
      comments: parsed.data.comments,
    });

  if (verifyError) redirect(`/dashboard/evidence/${evidenceId}?error=verification_failed`);

  revalidatePath("/dashboard/evidence");
  revalidatePath(`/dashboard/evidence/${evidenceId}`);
  revalidatePath("/dashboard/corrective-actions");

  // If evidence belongs to a corrective action, revalidate that too
  if (currentEvidence.entity_type === "corrective_action") {
    revalidatePath(`/dashboard/corrective-actions/${currentEvidence.entity_id}`);
    revalidatePath(`/dashboard/corrective-actions/${currentEvidence.entity_id}/verify`);
  }

  redirect(`/dashboard/evidence/${evidenceId}?verified=1`);
}

export async function submitEffectivenessReview(formData: FormData) {
  const context = await requireAppAccessContext();
  if (!context.organization) redirect("/dashboard?error=no_org");

  const correctiveActionId = formData.get("correctiveActionId") as string;
  const result = formData.get("result") as string;
  const reviewDate = formData.get("reviewDate") as string;
  const comments = formData.get("comments") as string;
  const followUpRequired = formData.get("followUpRequired") === "true";
  const followUpNotes = formData.get("followUpNotes") as string;

  if (!correctiveActionId || !result || !reviewDate) {
    redirect(`/dashboard/corrective-actions/${correctiveActionId}/effectiveness?error=missing_fields`);
  }

  const parsed = effectivenessReviewSchema.safeParse({
    correctiveActionId,
    result,
    reviewDate,
    comments: comments || null,
    followUpRequired,
    followUpNotes: followUpNotes || null,
  });

  if (!parsed.success) {
    redirect(`/dashboard/corrective-actions/${correctiveActionId}/effectiveness?error=validation`);
  }

  const supabase = await createSupabaseServerClient();

  // Verify the corrective action belongs to the user's org
  const { data: action } = await supabase
    .from("corrective_actions")
    .select("organization_id")
    .eq("id", correctiveActionId)
    .maybeSingle();

  if (!action || action.organization_id !== context.organization.id) {
    redirect("/dashboard/corrective-actions?error=unauthorized");
  }

  // Insert effectiveness review
  const { data: review, error } = await supabase
    .from("effectiveness_review")
    .insert({
      corrective_action_id: correctiveActionId,
      organization_id: context.organization.id,
      reviewer_id: context.user.id,
      result: parsed.data.result,
      review_date: new Date(parsed.data.reviewDate).toISOString(),
      comments: parsed.data.comments ?? null,
      follow_up_required: parsed.data.followUpRequired,
      follow_up_notes: parsed.data.followUpNotes ?? null,
    })
    .select("id")
    .single();

  if (error || !review) {
    redirect(`/dashboard/corrective-actions/${correctiveActionId}/effectiveness?error=save_failed`);
  }

  revalidatePath("/dashboard/corrective-actions");
  revalidatePath(`/dashboard/corrective-actions/${correctiveActionId}`);
  revalidatePath(`/dashboard/corrective-actions/${correctiveActionId}/effectiveness`);
  revalidatePath(`/dashboard/corrective-actions/${correctiveActionId}/verify`);
  redirect(`/dashboard/corrective-actions/${correctiveActionId}?effectiveness_reviewed=1`);
}

export async function submitClosureApproval(formData: FormData) {
  const context = await requireAppAccessContext();
  if (!context.organization) redirect("/dashboard?error=no_org");

  const correctiveActionId = formData.get("correctiveActionId") as string;
  const closureApproval = formData.get("closureApproval") as string;
  const comments = formData.get("comments") as string;

  if (!correctiveActionId || !closureApproval) {
    redirect(`/dashboard/corrective-actions/${correctiveActionId}?error=missing_fields`);
  }

  const parsed = closureApprovalSchema.safeParse({
    correctiveActionId,
    closureApproval,
    comments: comments || null,
  });

  if (!parsed.success) {
    redirect(`/dashboard/corrective-actions/${correctiveActionId}?error=validation`);
  }

  const supabase = await createSupabaseServerClient();

  const now = new Date().toISOString();

  const { error } = await supabase
    .from("corrective_actions")
    .update({
      closure_approval: parsed.data.closureApproval,
      closure_approved_by: parsed.data.closureApproval === "approved" ? context.user.id : null,
      closure_approved_at: parsed.data.closureApproval === "approved" ? now : null,
      status: parsed.data.closureApproval === "approved" ? "closed" : "effectiveness_review",
      updated_at: now,
    } as any)
    .eq("id", correctiveActionId)
    .eq("organization_id", context.organization.id);

  if (error) redirect(`/dashboard/corrective-actions/${correctiveActionId}?error=closure_failed`);

  revalidatePath("/dashboard/corrective-actions");
  revalidatePath(`/dashboard/corrective-actions/${correctiveActionId}`);
  revalidatePath(`/dashboard/corrective-actions/${correctiveActionId}/verify`);
  redirect(`/dashboard/corrective-actions/${correctiveActionId}?closure_updated=1`);
}

export async function deleteEvidence(formData: FormData) {
  const context = await requireAppAccessContext();
  if (!context.organization || context.profile.platformRole !== "platform_admin") {
    redirect("/dashboard?error=unauthorized");
  }

  const evidenceId = formData.get("evidenceId") as string;
  if (!evidenceId) redirect("/dashboard/evidence?error=missing_id");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("evidence")
    .delete()
    .eq("id", evidenceId)
    .eq("organization_id", context.organization.id);

  if (error) redirect("/dashboard/evidence?error=delete_failed");

  revalidatePath("/dashboard/evidence");
  revalidatePath("/dashboard/corrective-actions");
  redirect("/dashboard/evidence?deleted=1");
}
