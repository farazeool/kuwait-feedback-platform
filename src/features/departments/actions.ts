"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { departmentFormSchema } from "./schema";
import { requireOrganizationManagementContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function saveDepartment(formData: FormData) {
  const context = await requireOrganizationManagementContext();
  if (!context.organization) redirect("/dashboard/settings/departments?error=denied");
  const parsed = departmentFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard/settings/departments?error=invalid");
  const supabase = await createSupabaseServerClient();
  const v = parsed.data;
  const payload = {
    organization_id: context.organization.id,
    location_id: v.locationId,
    name_en: v.nameEn,
    name_ar: v.nameAr,
    slug: v.slug,
    status: v.status,
  };
  if (v.id) {
    const { error } = await supabase.from("departments").update(payload).eq("id", v.id).eq("organization_id", context.organization.id);
    redirect(error ? `/dashboard/settings/departments/${v.id}?error=denied` : `/dashboard/settings/departments/${v.id}?updated=1`);
  }
  const { data, error } = await supabase.from("departments").insert(payload).select("id").single();
  redirect(error || !data ? "/dashboard/settings/departments?error=denied" : `/dashboard/settings/departments/${data.id}?created=1`);
}

export async function deleteDepartment(formData: FormData) {
  const context = await requireOrganizationManagementContext();
  const parsed = z.object({ id: z.string().uuid() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard/settings/departments?error=invalid");
  const supabase = await createSupabaseServerClient();
  const orgId = context.organization?.id;
  if (!orgId) redirect("/dashboard/settings/departments?error=denied");
  const { error } = await supabase.from("departments").delete().eq("id", parsed.data.id).eq("organization_id", orgId);
  redirect(error ? "/dashboard/settings/departments?error=denied" : "/dashboard/settings/departments?deleted=1");
}
