"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireOrganizationManagementContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const signatureTemplateSchema = z.object({
  templateName: z.string().trim().min(1).max(200),
  headingEn: z.string().trim().min(1).max(200).default("How was your experience?"),
  headingAr: z.string().trim().max(200).default("كيف كانت تجربتك؟"),
  descriptionEn: z.string().trim().max(500).optional().default(""),
  descriptionAr: z.string().trim().max(500).optional().default(""),
  ratingStyle: z.enum(["emoji", "star", "three_option", "yes_no"]).default("emoji"),
  layout: z.enum(["horizontal", "vertical", "minimal", "branded"]).default("horizontal"),
  surveyId: z.string().uuid().nullable().optional(),
  showLogo: z.boolean().default(true),
  showBusinessName: z.boolean().default(true),
  showPrivacyNotice: z.boolean().default(false),
  privacyNoticeEn: z.string().trim().max(300).optional().default(""),
  privacyNoticeAr: z.string().trim().max(300).optional().default(""),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#2563eb"),
  iconSize: z.enum(["small", "medium", "large"]).default("medium"),
  alignment: z.enum(["left", "center", "right"]).default("left"),
  thankYouEn: z.string().trim().max(300).optional().default(""),
  thankYouAr: z.string().trim().max(300).optional().default(""),
  followUpEnabled: z.boolean().default(true),
  autoSubmitPositive: z.boolean().default(true),
});

export async function createTemplate(formData: FormData) {
  const context = await requireOrganizationManagementContext();
  if (!context.organization) redirect("/dashboard/settings/channels/email-signatures?error=denied");

  let input: unknown;
  try { input = JSON.parse(String(formData.get("template") ?? "")); } catch { redirect("/dashboard/settings/channels/email-signatures?error=invalid"); }

  const parsed = signatureTemplateSchema.safeParse(input);
  if (!parsed.success) redirect("/dashboard/settings/channels/email-signatures?error=invalid");

  const supabase = await createSupabaseServerClient() as never as { from: (t: string) => { insert: (v: Record<string, unknown>) => Promise<{ error: unknown }> } };
  const v = parsed.data;

  const { error } = await supabase.from("email_signature_templates").insert({
    organization_id: context.organization.id,
    template_name: v.templateName,
    heading_en: v.headingEn,
    heading_ar: v.headingAr || v.headingEn,
    description_en: v.descriptionEn || null,
    description_ar: v.descriptionAr || null,
    rating_style: v.ratingStyle,
    layout: v.layout,
    survey_id: v.surveyId || null,
    show_logo: v.showLogo,
    show_business_name: v.showBusinessName,
    show_privacy_notice: v.showPrivacyNotice,
    privacy_notice_en: v.privacyNoticeEn || null,
    privacy_notice_ar: v.privacyNoticeAr || null,
    brand_color: v.brandColor,
    icon_size: v.iconSize,
    alignment: v.alignment,
    thank_you_en: v.thankYouEn || null,
    thank_you_ar: v.thankYouAr || null,
    follow_up_enabled: v.followUpEnabled,
    auto_submit_positive: v.autoSubmitPositive,
    created_by: context.user.id,
  });

  redirect(error ? "/dashboard/settings/channels/email-signatures?error=creation_failed" : "/dashboard/settings/channels/email-signatures?created=1");
}

export async function updateTemplate(formData: FormData) {
  const context = await requireOrganizationManagementContext();
  if (!context.organization) redirect("/dashboard/settings/channels/email-signatures?error=denied");

  const templateId = formData.get("templateId") as string;
  if (!templateId) redirect("/dashboard/settings/channels/email-signatures?error=invalid");

  let input: unknown;
  try { input = JSON.parse(String(formData.get("template") ?? "")); } catch { redirect("/dashboard/settings/channels/email-signatures?error=invalid"); }

  const parsed = signatureTemplateSchema.safeParse(input);
  if (!parsed.success) redirect("/dashboard/settings/channels/email-signatures?error=invalid");

  const supabase = await createSupabaseServerClient() as never as {
    from: (t: string) => {
      insert: (v: Record<string, unknown>) => Promise<{ error: unknown }>;
      update: (v: Record<string, unknown>) => { eq: (c: string, v: string) => { eq: (c2: string, v2: string) => Promise<{ error: unknown }> } };
    }
  };
  const v = parsed.data;

  const { error } = await supabase
    .from("email_signature_templates")
    .update({
      template_name: v.templateName,
      heading_en: v.headingEn,
      heading_ar: v.headingAr || v.headingEn,
      description_en: v.descriptionEn || null,
      description_ar: v.descriptionAr || null,
      rating_style: v.ratingStyle,
      layout: v.layout,
      survey_id: v.surveyId || null,
      show_logo: v.showLogo,
      show_business_name: v.showBusinessName,
      show_privacy_notice: v.showPrivacyNotice,
      privacy_notice_en: v.privacyNoticeEn || null,
      privacy_notice_ar: v.privacyNoticeAr || null,
      brand_color: v.brandColor,
      icon_size: v.iconSize,
      alignment: v.alignment,
      thank_you_en: v.thankYouEn || null,
      thank_you_ar: v.thankYouAr || null,
      follow_up_enabled: v.followUpEnabled,
      auto_submit_positive: v.autoSubmitPositive,
    })
    .eq("id", templateId)
    .eq("organization_id", context.organization.id);

  redirect(error ? "/dashboard/settings/channels/email-signatures?error=update_failed" : "/dashboard/settings/channels/email-signatures?updated=1");
}

export async function archiveTemplate(formData: FormData) {
  const context = await requireOrganizationManagementContext();
  const templateId = formData.get("templateId") as string;
  if (!context.organization || !templateId) redirect("/dashboard/settings/channels/email-signatures?error=invalid");
  const supabase = await createSupabaseServerClient() as never as { from: (t: string) => { update: (v: Record<string, unknown>) => { eq: (c: string, v: string) => { eq: (c2: string, v2: string) => Promise<{ error: unknown }> } } } };
  await supabase
    .from("email_signature_templates")
    .update({ status: "archived" })
    .eq("id", templateId)
    .eq("organization_id", context.organization.id);
  redirect("/dashboard/settings/channels/email-signatures?updated=1");
}

export async function duplicateTemplate(formData: FormData) {
  const context = await requireOrganizationManagementContext();
  const templateId = formData.get("templateId") as string;
  if (!context.organization || !templateId) redirect("/dashboard/settings/channels/email-signatures?error=invalid");
  const supabase = await createSupabaseServerClient() as never as {
    from: (t: string) => {
      select: (c: string) => { eq: (c: string, v: string) => { eq: (c2: string, v2: string) => Promise<{ data: Record<string, unknown> | null }> } };
      insert: (v: Record<string, unknown>) => Promise<{ error: unknown }>;
    }
  };
  const { data: original } = await supabase
    .from("email_signature_templates")
    .select("*")
    .eq("id", templateId)
    .eq("organization_id", context.organization.id);

  const orig = original as Record<string, unknown> | null;
  if (!orig) redirect("/dashboard/settings/channels/email-signatures?error=not_found");

  const { error } = await supabase.from("email_signature_templates").insert({
    organization_id: context.organization.id,
    template_name: `${orig.template_name} (Copy)`,
    heading_en: orig.heading_en,
    heading_ar: orig.heading_ar,
    description_en: orig.description_en,
    description_ar: orig.description_ar,
    rating_style: orig.rating_style,
    layout: orig.layout,
    survey_id: orig.survey_id,
    show_logo: orig.show_logo,
    show_business_name: orig.show_business_name,
    show_privacy_notice: orig.show_privacy_notice,
    privacy_notice_en: orig.privacy_notice_en,
    privacy_notice_ar: orig.privacy_notice_ar,
    brand_color: orig.brand_color,
    icon_size: orig.icon_size,
    alignment: orig.alignment,
    thank_you_en: orig.thank_you_en,
    thank_you_ar: orig.thank_you_ar,
    follow_up_enabled: orig.follow_up_enabled,
    auto_submit_positive: orig.auto_submit_positive,
    created_by: context.user.id,
  });

  redirect(error ? "/dashboard/settings/channels/email-signatures?error=duplicate_failed" : "/dashboard/settings/channels/email-signatures?duplicated=1");
}

export async function bulkAssign(formData: FormData) {
  const context = await requireOrganizationManagementContext();
  if (!context.organization) redirect("/dashboard/settings/channels/email-signatures?error=denied");

  const templateId = formData.get("templateId") as string;
  const surveyId = formData.get("surveyId") as string;
  const campaignId = formData.get("campaignId") as string;
  const employeeIdsRaw = formData.get("employeeIds") as string;
  const locationIdsRaw = formData.get("locationIds") as string;

  const employeeIds: string[] = employeeIdsRaw ? employeeIdsRaw.split(",").filter(Boolean) : [];
  const locationIds: string[] = locationIdsRaw ? locationIdsRaw.split(",").filter(Boolean) : [];

  if (!templateId || !surveyId || (employeeIds.length === 0 && locationIds.length === 0)) {
    redirect("/dashboard/settings/channels/email-signatures?error=invalid_assignment");
  }

  const supabase = await createSupabaseServerClient() as never as { rpc: (name: string, args: Record<string, unknown>) => Promise<{ error: unknown }> };
  const { error } = await supabase.rpc("bulk_create_signature_assignments", {
    p_organization_id: context.organization.id,
    p_template_id: templateId,
    p_survey_id: surveyId,
    p_campaign_id: campaignId || null,
    p_employee_ids: employeeIds.length > 0 ? employeeIds : null,
    p_location_ids: locationIds.length > 0 ? locationIds : null,
  });

  redirect(error ? "/dashboard/settings/channels/email-signatures?error=assignment_failed" : "/dashboard/settings/channels/email-signatures?assigned=1");
}

export async function revokeAssignment(formData: FormData) {
  const context = await requireOrganizationManagementContext();
  const assignmentId = formData.get("assignmentId") as string;
  if (!context.organization || !assignmentId) redirect("/dashboard/settings/channels/email-signatures?error=invalid");
  const supabase = await createSupabaseServerClient() as never as { from: (t: string) => { update: (v: Record<string, unknown>) => { eq: (c: string, v: string) => { eq: (c2: string, v2: string) => Promise<{ error: unknown }> } } } };
  await supabase
    .from("email_signature_assignments")
    .update({ status: "revoked" })
    .eq("id", assignmentId)
    .eq("organization_id", context.organization.id);
  redirect("/dashboard/settings/channels/email-signatures?revoked=1");
}

export async function regenerateLink(formData: FormData) {
  const context = await requireOrganizationManagementContext();
  const assignmentId = formData.get("assignmentId") as string;
  if (!context.organization || !assignmentId) redirect("/dashboard/settings/channels/email-signatures?error=invalid");
  const supabase = await createSupabaseServerClient() as never as { from: (t: string) => { update: (v: Record<string, unknown>) => { eq: (c: string, v: string) => { eq: (c2: string, v2: string) => Promise<{ error: unknown }> } } } };
  const newToken = crypto.randomUUID().replace(/-/g, "").slice(0, 36);
  await supabase
    .from("email_signature_assignments")
    .update({ public_token: newToken, status: "active" })
    .eq("id", assignmentId)
    .eq("organization_id", context.organization.id);
  redirect("/dashboard/settings/channels/email-signatures?regenerated=1");
}
