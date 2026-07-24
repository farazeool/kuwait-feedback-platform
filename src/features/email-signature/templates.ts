import "server-only";

import { requireAppAccessContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface SignatureTemplate {
  id: string;
  organization_id: string;
  template_name: string;
  heading_en: string;
  heading_ar: string;
  description_en: string | null;
  description_ar: string | null;
  rating_style: string;
  layout: string;
  survey_id: string | null;
  show_logo: boolean;
  show_business_name: boolean;
  show_privacy_notice: boolean;
  privacy_notice_en: string | null;
  privacy_notice_ar: string | null;
  brand_color: string;
  icon_size: string;
  alignment: string;
  thank_you_en: string | null;
  thank_you_ar: string | null;
  follow_up_enabled: boolean;
  auto_submit_positive: boolean;
  is_default: boolean;
  status: string;
  created_at: string;
}

export interface SignatureAssignment {
  id: string;
  organization_id: string;
  template_id: string;
  location_id: string | null;
  department_id: string | null;
  employee_id: string | null;
  survey_id: string;
  campaign_id: string | null;
  public_token: string;
  status: string;
  expires_at: string | null;
  last_clicked_at: string | null;
  click_count: number;
  response_count: number;
  created_at: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anySb = (supabase: any) => supabase;

export async function listTemplates() {
  const context = await requireAppAccessContext();
  if (!context.organization) return { context, templates: [] as SignatureTemplate[], surveys: [] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = anySb(await createSupabaseServerClient()) as any;
  const orgId = context.organization.id;

  const [{ data: templates }, { data: surveys }] = await Promise.all([
    supabase
      .from("email_signature_templates")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false }),
    supabase
      .from("surveys")
      .select("id, title_en, title_ar")
      .eq("organization_id", orgId)
      .eq("status", "active")
      .order("title_en"),
  ]);

  return { context, templates: (templates ?? []) as SignatureTemplate[], surveys: surveys ?? [] };
}

export async function getTemplate(templateId: string) {
  const context = await requireAppAccessContext();
  if (!context.organization) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = anySb(await createSupabaseServerClient()) as any;
  const { data } = await supabase
    .from("email_signature_templates")
    .select("*")
    .eq("id", templateId)
    .eq("organization_id", context.organization.id)
    .single();
  return data as SignatureTemplate | null;
}

export async function getAssignments(templateId?: string) {
  const context = await requireAppAccessContext();
  if (!context.organization) return { context, assignments: [] as SignatureAssignment[], employees: [], locations: [] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = anySb(await createSupabaseServerClient()) as any;
  const orgId = context.organization.id;

  let query = supabase
    .from("email_signature_assignments")
    .select("*, location:locations!location_id(name_en, name_ar), employee:profiles!employee_id(display_name), template:email_signature_templates!template_id(template_name)")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (templateId) query = query.eq("template_id", templateId);

  const [{ data: assignments }, { data: employees }, { data: locations }] = await Promise.all([
    query,
    supabase
      .from("organization_memberships")
      .select("user_id, profile:profiles!user_id(display_name, id)")
      .eq("organization_id", orgId)
      .eq("status", "active"),
    supabase
      .from("locations")
      .select("id, name_en, name_ar")
      .eq("organization_id", orgId)
      .eq("status", "active")
      .order("name_en"),
  ]);

  return {
    context,
    assignments: (assignments ?? []) as SignatureAssignment[],
    employees: (employees ?? []).map((e: Record<string, unknown>) => ({
      id: (e.profile as Record<string, unknown>)?.id ?? e.user_id,
      displayName: (e.profile as Record<string, unknown>)?.display_name ?? "Unknown",
    })),
    locations: locations ?? [],
  };
}

export function buildSignatureHtml(template: SignatureTemplate, publicToken: string, appUrl: string, orgName: string) {
  const feedbackUrl = `${appUrl}/feedback/s/${publicToken}`;
  const color = template.brand_color ?? "#2563eb";
  const encodedUrl = feedbackUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const alignStyle = template.alignment === "center" ? "text-align:center;" : template.alignment === "right" ? "text-align:right;" : "text-align:left;";

  let ratingHtml = "";
  if (template.rating_style === "emoji") {
    ratingHtml = `<a href="${encodedUrl}?r=5" style="text-decoration:none;font-size:${template.icon_size === "large" ? "28" : template.icon_size === "small" ? "18" : "22"}px;letter-spacing:4px;display:inline-block;padding:2px 0;" target="_blank">&#128522;</a>
<a href="${encodedUrl}?r=4" style="text-decoration:none;font-size:${template.icon_size === "large" ? "28" : template.icon_size === "small" ? "18" : "22"}px;letter-spacing:4px;display:inline-block;padding:2px 0;" target="_blank">&#128578;</a>
<a href="${encodedUrl}?r=3" style="text-decoration:none;font-size:${template.icon_size === "large" ? "28" : template.icon_size === "small" ? "18" : "22"}px;letter-spacing:4px;display:inline-block;padding:2px 0;" target="_blank">&#128528;</a>
<a href="${encodedUrl}?r=2" style="text-decoration:none;font-size:${template.icon_size === "large" ? "28" : template.icon_size === "small" ? "18" : "22"}px;letter-spacing:4px;display:inline-block;padding:2px 0;" target="_blank">&#128542;</a>
<a href="${encodedUrl}?r=1" style="text-decoration:none;font-size:${template.icon_size === "large" ? "28" : template.icon_size === "small" ? "18" : "22"}px;letter-spacing:4px;display:inline-block;padding:2px 0;" target="_blank">&#128545;</a>`;
  } else if (template.rating_style === "star") {
    ratingHtml = `<a href="${encodedUrl}?r=5" style="text-decoration:none;color:${color};font-size:${template.icon_size === "large" ? "26" : template.icon_size === "small" ? "16" : "20"}px;display:inline-block;padding:2px;letter-spacing:2px;" target="_blank">&#9733;</a>
<a href="${encodedUrl}?r=4" style="text-decoration:none;color:${color};font-size:${template.icon_size === "large" ? "26" : template.icon_size === "small" ? "16" : "20"}px;display:inline-block;padding:2px;letter-spacing:2px;" target="_blank">&#9733;</a>
<a href="${encodedUrl}?r=3" style="text-decoration:none;color:${color};font-size:${template.icon_size === "large" ? "26" : template.icon_size === "small" ? "16" : "20"}px;display:inline-block;padding:2px;letter-spacing:2px;" target="_blank">&#9733;</a>
<a href="${encodedUrl}?r=2" style="text-decoration:none;color:${color};font-size:${template.icon_size === "large" ? "26" : template.icon_size === "small" ? "16" : "20"}px;display:inline-block;padding:2px;letter-spacing:2px;" target="_blank">&#9733;</a>
<a href="${encodedUrl}?r=1" style="text-decoration:none;color:#ccc;font-size:${template.icon_size === "large" ? "26" : template.icon_size === "small" ? "16" : "20"}px;display:inline-block;padding:2px;letter-spacing:2px;" target="_blank">&#9733;</a>`;
  } else if (template.rating_style === "three_option") {
    ratingHtml = `<a href="${encodedUrl}?r=3" style="display:inline-block;background-color:#22c55e;color:#fff;padding:8px 18px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;margin:2px;" target="_blank">Great</a>
<a href="${encodedUrl}?r=2" style="display:inline-block;background-color:#f59e0b;color:#fff;padding:8px 18px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;margin:2px;" target="_blank">Okay</a>
<a href="${encodedUrl}?r=1" style="display:inline-block;background-color:#ef4444;color:#fff;padding:8px 18px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;margin:2px;" target="_blank">Poor</a>`;
  } else if (template.rating_style === "yes_no") {
    ratingHtml = `<a href="${encodedUrl}?r=5" style="display:inline-block;background-color:#22c55e;color:#fff;padding:8px 22px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;margin:2px;" target="_blank">Yes &#10003;</a>
<a href="${encodedUrl}?r=1" style="display:inline-block;background-color:#ef4444;color:#fff;padding:8px 22px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;margin:2px;" target="_blank">No &#10007;</a>`;
  }

  const heading = template.heading_en;
  const description = template.description_en
    ? `<tr><td style="padding:0 0 4px 0;font-size:12px;color:#666;${alignStyle}">${template.description_en}</td></tr>`
    : "";

  return `<!-- Email Signature - Generated by Kuwait Feedback Platform -->
<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;${alignStyle}">
${template.show_business_name ? `<tr><td style="padding:0 0 2px 0;font-size:13px;font-weight:600;color:#333;${alignStyle}">${orgName}</td></tr>` : ""}
<tr><td style="padding:0 0 4px 0;font-size:13px;color:#333;${alignStyle}">${heading}</td></tr>
${description}
<tr><td style="padding:4px 0 2px 0;${alignStyle}">${ratingHtml}</td></tr>
${template.show_privacy_notice && template.privacy_notice_en ? `<tr><td style="padding:4px 0 0 0;font-size:10px;color:#999;${alignStyle}">${template.privacy_notice_en}</td></tr>` : ""}
</table>`;
}

export function buildSignaturePlainText(publicToken: string, appUrl: string, orgName: string, template: SignatureTemplate) {
  const feedbackUrl = `${appUrl}/feedback/s/${publicToken}`;
  return `${orgName}
${template.heading_en}
${template.description_en ? template.description_en + "\n" : ""}
How did we do? Rate us here: ${feedbackUrl}
${template.show_privacy_notice && template.privacy_notice_en ? template.privacy_notice_en : ""}`;
}
