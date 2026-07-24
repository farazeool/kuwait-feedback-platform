"use server";

import { redirect } from "next/navigation";

import { requireOrganizationManagementContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { distributionTemplateSchema, distributionAssignmentSchema } from "./schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = (s: any) => s;

export async function createTemplate(formData: FormData) {
  const ctx = await requireOrganizationManagementContext();
  if (!ctx.organization) redirect("/dashboard/distribution/templates?error=denied");

  let input: unknown;
  try { input = JSON.parse(String(formData.get("template") ?? "")); } catch { redirect("/dashboard/distribution/templates?error=invalid"); }
  const parsed = distributionTemplateSchema.safeParse(input);
  if (!parsed.success) redirect("/dashboard/distribution/templates?error=invalid");

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

  redirect(error ? `/dashboard/distribution/templates?error=creation_failed` : `/dashboard/distribution/templates?created=1`);
}

export async function updateTemplate(formData: FormData) {
  const ctx = await requireOrganizationManagementContext();
  if (!ctx.organization) redirect("/dashboard/distribution/templates?error=denied");

  const templateId = formData.get("templateId") as string;
  if (!templateId) redirect("/dashboard/distribution/templates?error=invalid");

  let input: unknown;
  try { input = JSON.parse(String(formData.get("template") ?? "")); } catch { redirect("/dashboard/distribution/templates?error=invalid"); }
  const parsed = distributionTemplateSchema.safeParse(input);
  if (!parsed.success) redirect("/dashboard/distribution/templates?error=invalid");

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

  redirect(error ? `/dashboard/distribution/templates?error=update_failed` : `/dashboard/distribution/templates?updated=1`);
}

export async function archiveTemplate(formData: FormData) {
  const ctx = await requireOrganizationManagementContext();
  const templateId = formData.get("templateId") as string;
  if (!ctx.organization || !templateId) redirect("/dashboard/distribution/templates?error=invalid");
  const supabase = sb(await createSupabaseServerClient());
  await supabase.from("distribution_templates").update({ is_active: false }).eq("id", templateId).eq("organization_id", ctx.organization.id);
  redirect("/dashboard/distribution/templates?updated=1");
}

export async function createAssignment(formData: FormData) {
  const ctx = await requireOrganizationManagementContext();
  if (!ctx.organization) redirect("/dashboard/distribution/assignments?error=denied");

  let input: unknown;
  try { input = JSON.parse(String(formData.get("assignment") ?? "")); } catch { redirect("/dashboard/distribution/assignments?error=invalid"); }
  const parsed = distributionAssignmentSchema.safeParse(input);
  if (!parsed.success) redirect("/dashboard/distribution/assignments?error=invalid");

  const supabase = sb(await createSupabaseServerClient());
  const v = parsed.data;

  const targetCol = v.targetType === "employee" ? "assigned_employee_id" :
    v.targetType === "location" ? "assigned_location_id" : "assigned_touchpoint_id";

  const { error } = await supabase.from("distribution_assignments").insert({
    organization_id: ctx.organization.id,
    template_id: v.templateId,
    survey_id: v.surveyId,
    campaign_id: v.campaignId || null,
    [targetCol]: v.targetId,
    metadata: v.metadata,
    expires_at: v.expiresAt || null,
    created_by: ctx.user.id,
  });

  redirect(error ? `/dashboard/distribution/assignments?error=creation_failed` : `/dashboard/distribution/assignments?created=1`);
}

export async function revokeAssignment(formData: FormData) {
  const ctx = await requireOrganizationManagementContext();
  const assignmentId = formData.get("assignmentId") as string;
  if (!ctx.organization || !assignmentId) redirect("/dashboard/distribution/assignments?error=invalid");
  const supabase = sb(await createSupabaseServerClient());
  await supabase.from("distribution_assignments").update({ status: "revoked" }).eq("id", assignmentId).eq("organization_id", ctx.organization.id);
  redirect("/dashboard/distribution/assignments?revoked=1");
}

export async function bulkAssign(formData: FormData) {
  const ctx = await requireOrganizationManagementContext();
  if (!ctx.organization) redirect("/dashboard/distribution/assignments?error=denied");

  const templateId = formData.get("templateId") as string;
  const surveyId = formData.get("surveyId") as string;
  const campaignId = formData.get("campaignId") as string;
  const employeeIdsRaw = formData.get("employeeIds") as string;
  const locationIdsRaw = formData.get("locationIds") as string;
  const employeeIds = employeeIdsRaw ? employeeIdsRaw.split(",").filter(Boolean) : [];
  const locationIds = locationIdsRaw ? locationIdsRaw.split(",").filter(Boolean) : [];

  if (!templateId || !surveyId || (employeeIds.length === 0 && locationIds.length === 0)) {
    redirect("/dashboard/distribution/assignments?error=invalid");
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

  redirect(error ? "/dashboard/distribution/assignments?error=failed" : "/dashboard/distribution/assignments?assigned=1");
}
