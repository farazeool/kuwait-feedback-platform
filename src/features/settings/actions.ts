"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";

import { brandingSettingsSchema, detectBrandImage, locationSettingsSchema, organizationSettingsSchema } from "./schemas";
import { requireOrganizationManagementContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export async function updateOrganizationSettings(formData: FormData) {
  const context = await requireOrganizationManagementContext();
  if (!context.organization) redirect("/dashboard/settings?error=denied");
  const parsed = organizationSettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard/settings/organization?error=invalid");
  const supabase = await createSupabaseServerClient();
  const v = parsed.data;
  const { error } = await supabase.rpc("update_organization_settings", { p_organization_id: context.organization.id, p_name_en: v.nameEn, p_name_ar: v.nameAr, p_slug: v.slug, p_business_category: v.businessCategory, p_phone: v.phone || "", p_email: v.email || "", p_website: v.website || "", p_description_en: v.descriptionEn || "", p_description_ar: v.descriptionAr || "", p_default_locale: v.defaultLocale, p_date_format: v.dateFormat, p_number_format: v.numberFormat, p_support_email: v.supportEmail || "", p_support_phone: v.supportPhone || "" });
  redirect(error ? "/dashboard/settings/organization?error=denied" : "/dashboard/settings/organization?updated=1");
}

async function uploadBrandFile(file: File, organizationId: string, supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  if (!(file instanceof File) || !file.size) return null;
  if (file.size > 2_097_152) throw new Error("file_size");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectBrandImage(bytes);
  if (!detected) throw new Error("file_type");
  const path = `${organizationId}/${randomUUID()}.${detected.extension}`;
  const { error } = await supabase.storage.from("organization-branding").upload(path, bytes, { contentType: detected.mime, upsert: false });
  if (error) throw new Error("upload");
  return path;
}

export async function updateBranding(formData: FormData) {
  const context = await requireOrganizationManagementContext();
  if (!context.organization) redirect("/dashboard/settings/branding?error=denied");
  const parsed = brandingSettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard/settings/branding?error=invalid");
  const supabase = await createSupabaseServerClient();
  const { data: current } = await supabase.from("organizations").select("logo_path, icon_logo_path, dark_logo_path").eq("id", context.organization.id).single();
  const uploaded: string[] = [];
  try {
    const newLogo = await uploadBrandFile(formData.get("logo") as File, context.organization.id, supabase);
    if (newLogo) uploaded.push(newLogo);
    const logo = newLogo ?? current?.logo_path ?? null;
    const newIcon = await uploadBrandFile(formData.get("iconLogo") as File, context.organization.id, supabase);
    if (newIcon) uploaded.push(newIcon);
    const icon = newIcon ?? current?.icon_logo_path ?? null;
    const newDark = await uploadBrandFile(formData.get("darkLogo") as File, context.organization.id, supabase);
    if (newDark) uploaded.push(newDark);
    const dark = newDark ?? current?.dark_logo_path ?? null;
    const v = parsed.data;
    const { error } = await supabase.rpc("update_organization_branding", { p_organization_id: context.organization.id, p_primary_color: v.primaryColor, p_accent_color: v.accentColor, p_logo_path: logo ?? "", p_icon_logo_path: icon ?? "", p_dark_logo_path: dark ?? "", p_survey_header_style: v.headerStyle, p_default_thank_you_en: v.thankYouEn || "", p_default_thank_you_ar: v.thankYouAr || "", p_footer_text_en: v.footerEn || "", p_footer_text_ar: v.footerAr || "" });
    if (error) throw error;
    const retained = new Set([logo, icon, dark].filter((path): path is string => typeof path === "string"));
    const old = [current?.logo_path, current?.icon_logo_path, current?.dark_logo_path].filter((path): path is string => typeof path === "string" && !retained.has(path));
    if (old.length) await supabase.storage.from("organization-branding").remove(old);
  } catch {
    if (uploaded.length) await supabase.storage.from("organization-branding").remove(uploaded);
    redirect("/dashboard/settings/branding?error=upload");
  }
  redirect("/dashboard/settings/branding?updated=1");
}

export async function saveLocation(formData: FormData) {
  const context = await requireOrganizationManagementContext();
  const parsed = locationSettingsSchema.safeParse({ ...Object.fromEntries(formData), locationId: formData.get("locationId") || undefined, organizationId: context.organization?.id, inheritsTimezone: formData.get("inheritsTimezone") === "on" });
  if (!parsed.success) redirect("/dashboard/locations?error=invalid");
  const supabase = await createSupabaseServerClient();
  const v = parsed.data;
  if (v.locationId) {
    const { error } = await supabase.rpc("update_location_v2", { p_location_id: v.locationId, p_slug: v.slug, p_name_en: v.nameEn, p_name_ar: v.nameAr, p_governorate: v.governorate, p_area: v.area, p_address_en: v.addressEn || "", p_address_ar: v.addressAr || "", p_phone: v.phone || "", p_email: v.email || "", p_opening_hours: v.openingHours as Json, p_inherits_timezone: v.inheritsTimezone, p_timezone: v.timezone, p_status: v.status });
    redirect(error ? `/dashboard/locations/${v.locationId}/edit?error=denied` : `/dashboard/locations/${v.locationId}?updated=1`);
  }
  const { data, error } = await supabase.rpc("create_location_v2", { p_organization_id: v.organizationId, p_slug: v.slug, p_name_en: v.nameEn, p_name_ar: v.nameAr, p_governorate: v.governorate, p_area: v.area, p_address_en: v.addressEn || "", p_address_ar: v.addressAr || "", p_phone: v.phone || "", p_email: v.email || "", p_opening_hours: v.openingHours as Json, p_inherits_timezone: v.inheritsTimezone, p_timezone: v.timezone });
  redirect(error || !data ? "/dashboard/locations/new?error=denied" : `/dashboard/locations/${data}`);
}
