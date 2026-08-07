"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { touchpointFormSchema } from "./schema";
import { requireOrganizationManagementContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function saveTouchpoint(formData: FormData) {
  const context = await requireOrganizationManagementContext();
  if (!context.organization) redirect("/dashboard/settings/touchpoints?error=denied");
  const parsed = touchpointFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard/settings/touchpoints?error=invalid");
  const supabase = await createSupabaseServerClient();
  const v = parsed.data;
  const payload = {
    organization_id: context.organization.id,
    location_id: v.locationId,
    department_id: v.departmentId,
    survey_id: v.surveyId || null,
    name_en: v.nameEn,
    name_ar: v.nameAr,
    slug: v.slug,
    channel: v.channel,
    status: v.status,
  };
  if (v.id) {
    const { error } = await supabase.from("touchpoints").update(payload).eq("id", v.id).eq("organization_id", context.organization.id);
    redirect(error ? `/dashboard/settings/touchpoints/${v.id}?error=denied` : `/dashboard/settings/touchpoints/${v.id}?updated=1`);
  }
  const { data, error } = await supabase.from("touchpoints").insert(payload).select("id").single();
  redirect(error || !data ? "/dashboard/settings/touchpoints?error=denied" : `/dashboard/settings/touchpoints/${data.id}?created=1`);
}

export async function deleteTouchpoint(formData: FormData) {
  const context = await requireOrganizationManagementContext();
  const parsed = z.object({ id: z.string().uuid() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard/settings/touchpoints?error=invalid");
  const supabase = await createSupabaseServerClient();
  const orgId = context.organization?.id;
  if (!orgId) redirect("/dashboard/settings/touchpoints?error=denied");
  const { error } = await supabase.from("touchpoints").delete().eq("id", parsed.data.id).eq("organization_id", orgId);
  redirect(error ? "/dashboard/settings/touchpoints?error=denied" : "/dashboard/settings/touchpoints?deleted=1");
}
