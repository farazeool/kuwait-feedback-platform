"use server";

import { redirect } from "next/navigation";

import { requireOrganizationManagementContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { campaignSchema } from "./schema";

export async function createCampaign(formData: FormData) {
  const context = await requireOrganizationManagementContext();
  if (!context.organization) redirect("/dashboard/settings/channels/campaigns?error=denied");

  const parsed = campaignSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard/settings/channels/campaigns?error=invalid");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createSupabaseServerClient()) as any;
  const v = parsed.data;

  const { error } = await supabase.from("campaigns").insert({
    organization_id: context.organization.id,
    survey_id: v.surveyId,
    name_en: v.nameEn,
    name_ar: v.nameAr || v.nameEn,
    channel: v.channel,
    starts_at: v.startsAt || null,
    ends_at: v.endsAt || null,
    created_by: context.user.id,
  });

  redirect(error
    ? "/dashboard/settings/channels/campaigns?error=denied"
    : "/dashboard/settings/channels/campaigns?created=1");
}

export async function updateCampaign(formData: FormData) {
  const context = await requireOrganizationManagementContext();
  if (!context.organization) redirect("/dashboard/settings/channels/campaigns?error=denied");

  const campaignId = formData.get("campaignId") as string;
  if (!campaignId) redirect("/dashboard/settings/channels/campaigns?error=invalid");

  const parsed = campaignSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard/settings/channels/campaigns?error=invalid");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createSupabaseServerClient()) as any;
  const v = parsed.data;

  const { error } = await supabase
    .from("campaigns")
    .update({
      name_en: v.nameEn,
      name_ar: v.nameAr || v.nameEn,
      channel: v.channel,
      starts_at: v.startsAt || null,
      ends_at: v.endsAt || null,
    })
    .eq("id", campaignId)
    .eq("organization_id", context.organization.id);

  redirect(error
    ? "/dashboard/settings/channels/campaigns?error=denied"
    : "/dashboard/settings/channels/campaigns?updated=1");
}

export async function deleteCampaign(formData: FormData) {
  const context = await requireOrganizationManagementContext();
  if (!context.organization) redirect("/dashboard/settings/channels/campaigns?error=denied");

  const campaignId = formData.get("campaignId") as string;
  if (!campaignId) redirect("/dashboard/settings/channels/campaigns?error=invalid");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createSupabaseServerClient()) as any;
  const { error } = await supabase
    .from("campaigns")
    .delete()
    .eq("id", campaignId)
    .eq("organization_id", context.organization.id);

  redirect(error
    ? "/dashboard/settings/channels/campaigns?error=denied"
    : "/dashboard/settings/channels/campaigns?deleted=1");
}
