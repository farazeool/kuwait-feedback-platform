"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireOrganizationManagementContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { distributionTemplateSchema, distributionAssignmentSchema } from "./schema";

// The distribution template/assignment UI lives on the email-signatures channel
// page, which switches views via the `tab` query param. Templates are the
// default tab; assignments require `?tab=assignments`.
const CHANNEL_URL = "/dashboard/settings/channels/email-signatures";
const TEMPLATES_URL = CHANNEL_URL;
const ASSIGNMENTS_URL = `${CHANNEL_URL}?tab=assignments`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = (s: any) => s;

export async function createTemplate(formData: FormData) {
  const ctx = await requireOrganizationManagementContext();
  if (!ctx.organization) redirect(`${TEMPLATES_URL}?error=denied`);

  let input: unknown;
  try { input = JSON.parse(String(formData.get("template") ?? "")); } catch { redirect(`${TEMPLATES_URL}?error=invalid`); }
  const parsed = distributionTemplateSchema.safeParse(input);
  if (!parsed.success) redirect(`${TEMPLATES_URL}?error=invalid`);

  const supabase = sb(await createSupabaseServerClient());
  const v = parsed.data;

  const { error } = await supabase.from("distribution_templates").insert({
    organization_id: ctx.organization.id,
    channel: v.channel,
    template_name: v.templateName,
    description: v.description || null,
    is_default: v.isDefault,
    config: v.config,
    render_config: v.renderConfig,
    created_by: ctx.user.id,
  });

  redirect(error ? `${TEMPLATES_URL}?error=creation_failed` : `${TEMPLATES_URL}?created=1`);
}

export async function updateTemplate(formData: FormData) {
  const ctx = await requireOrganizationManagementContext();
  if (!ctx.organization) redirect(`${TEMPLATES_URL}?error=denied`);

  const templateId = formData.get("templateId") as string;
  if (!templateId) redirect(`${TEMPLATES_URL}?error=invalid`);

  let input: unknown;
  try { input = JSON.parse(String(formData.get("template") ?? "")); } catch { redirect(`${TEMPLATES_URL}?error=invalid`); }
  const parsed = distributionTemplateSchema.safeParse(input);
  if (!parsed.success) redirect(`${TEMPLATES_URL}?error=invalid`);

  const supabase = sb(await createSupabaseServerClient());
  const v = parsed.data;

  const { error } = await supabase
    .from("distribution_templates")
    .update({
      channel: v.channel,
      template_name: v.templateName,
      description: v.description || null,
      is_default: v.isDefault,
      config: v.config,
      render_config: v.renderConfig,
    })
    .eq("id", templateId)
    .eq("organization_id", ctx.organization.id);

  redirect(error ? `${TEMPLATES_URL}?error=update_failed` : `${TEMPLATES_URL}?updated=1`);
}

export async function archiveTemplate(formData: FormData) {
  const ctx = await requireOrganizationManagementContext();
  const templateId = formData.get("templateId") as string;
  if (!ctx.organization || !templateId) redirect(`${TEMPLATES_URL}?error=invalid`);
  const supabase = sb(await createSupabaseServerClient());
  await supabase.from("distribution_templates").update({ is_active: false }).eq("id", templateId).eq("organization_id", ctx.organization.id);
  redirect(`${TEMPLATES_URL}?updated=1`);
}

export async function createAssignment(formData: FormData) {
  const ctx = await requireOrganizationManagementContext();
  if (!ctx.organization) redirect(`${ASSIGNMENTS_URL}&error=denied`);

  let input: unknown;
  try { input = JSON.parse(String(formData.get("assignment") ?? "")); } catch { redirect(`${ASSIGNMENTS_URL}&error=invalid`); }
  const parsed = distributionAssignmentSchema.safeParse(input);
  if (!parsed.success) redirect(`${ASSIGNMENTS_URL}&error=invalid`);

  const supabase = sb(await createSupabaseServerClient());
  const v = parsed.data;

  const fkCols =
    v.kind === "fk"
      ? {
          [v.targetType === "employee"
            ? "assigned_employee_id"
            : v.targetType === "location"
              ? "assigned_location_id"
              : "assigned_touchpoint_id"]: v.targetId,
        }
      : { subject_type: v.subjectType, subject_id: v.subjectId };

  const payload = {
    organization_id: ctx.organization.id,
    template_id: v.templateId,
    survey_id: v.surveyId ?? null,
    campaign_id: v.campaignId || null,
    ...fkCols,
    metadata: v.metadata,
    expires_at: v.expiresAt || null,
    created_by: ctx.user.id,
  };

  const { error } = await supabase.from("distribution_assignments").insert(payload);

  if (error) {
    const safeError = {
      code: error?.code ?? null,
      message: error?.message ?? (error instanceof Error ? error.message : String(error)),
      details: error?.details ?? null,
      hint: error?.hint ?? null,
      constraint: (error as { constraint?: string })?.constraint ?? null,
    };

    console.error("[createAssignment] Database error", safeError);

    // Check for duplicate constraint violation
    if (error.code === "23505" && error.message?.includes("da_template_employee_unique")) {
      redirect(`${ASSIGNMENTS_URL}&error=duplicate`);
    }

    redirect(`${ASSIGNMENTS_URL}&error=creation_failed`);
  }

  // Revalidate the assignments page to show the new assignment
  revalidatePath(CHANNEL_URL);
  redirect(`${ASSIGNMENTS_URL}&assigned=1`);
}

export async function revokeAssignment(formData: FormData) {
  const ctx = await requireOrganizationManagementContext();
  const assignmentId = formData.get("assignmentId") as string;
  if (!ctx.organization || !assignmentId) redirect(`${ASSIGNMENTS_URL}&error=invalid`);
  const supabase = sb(await createSupabaseServerClient());
  await supabase.from("distribution_assignments").update({ status: "revoked" }).eq("id", assignmentId).eq("organization_id", ctx.organization.id);
  redirect(`${ASSIGNMENTS_URL}&revoked=1`);
}

export async function bulkAssign(formData: FormData) {
  const ctx = await requireOrganizationManagementContext();
  if (!ctx.organization) redirect(`${ASSIGNMENTS_URL}&error=denied`);

  const templateId = formData.get("templateId") as string;
  const surveyId = formData.get("surveyId") as string;
  const campaignId = formData.get("campaignId") as string;
  const employeeIdsRaw = formData.get("employeeIds") as string;
  const locationIdsRaw = formData.get("locationIds") as string;
  const employeeIds = employeeIdsRaw ? employeeIdsRaw.split(",").filter(Boolean) : [];
  const locationIds = locationIdsRaw ? locationIdsRaw.split(",").filter(Boolean) : [];

  if (!templateId || !surveyId || (employeeIds.length === 0 && locationIds.length === 0)) {
    redirect(`${ASSIGNMENTS_URL}&error=invalid`);
  }

  const supabase = sb(await createSupabaseServerClient());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.rpc as any)("bulk_create_distribution_assignments", {
    p_organization_id: ctx.organization.id,
    p_template_id: templateId,
    p_survey_id: surveyId,
    p_campaign_id: campaignId || null,
    p_employee_ids: employeeIds.length > 0 ? employeeIds : null,
    p_location_ids: locationIds.length > 0 ? locationIds : null,
  });

  redirect(error ? `${ASSIGNMENTS_URL}&error=failed` : `${ASSIGNMENTS_URL}&assigned=1`);
}
