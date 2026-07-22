"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { alertConfigFormSchema } from "./schema";
import { requireOrganizationManagementContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function saveAlertConfiguration(formData: FormData) {
  const context = await requireOrganizationManagementContext();
  if (!context.organization) redirect("/dashboard/settings/alerts?error=denied");
  const parsed = alertConfigFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard/settings/alerts?error=invalid");
  const supabase = await createSupabaseServerClient();
  const v = parsed.data;
  const payload = {
    organization_id: context.organization.id,
    rule_type: v.ruleType,
    threshold_value: v.thresholdValue,
    severity: v.severity,
    deduplication_minutes: v.deduplicationMinutes,
    is_active: v.isActive === "true",
    location_id: v.locationId || null,
  };
  if (v.id) {
    const { error } = await supabase.from("alert_configurations").update(payload).eq("id", v.id).eq("organization_id", context.organization.id);
    redirect(error ? `/dashboard/settings/alerts/${v.id}?error=denied` : `/dashboard/settings/alerts/${v.id}?updated=1`);
  }
  const { data, error } = await supabase.from("alert_configurations").insert(payload).select("id").single();
  redirect(error || !data ? "/dashboard/settings/alerts?error=denied" : `/dashboard/settings/alerts/${data.id}?created=1`);
}

export async function toggleAlertConfiguration(formData: FormData) {
  const context = await requireOrganizationManagementContext();
  const parsed = z.object({ id: z.string().uuid(), isActive: z.enum(["true", "false"]) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard/settings/alerts?error=invalid");
  const supabase = await createSupabaseServerClient();
  const orgId = context.organization?.id;
  if (!orgId) redirect("/dashboard/settings/alerts?error=denied");
  const { error } = await supabase.from("alert_configurations").update({ is_active: parsed.data.isActive === "true" }).eq("id", parsed.data.id).eq("organization_id", orgId);
  redirect(error ? "/dashboard/settings/alerts?error=denied" : "/dashboard/settings/alerts?toggled=1");
}

export async function deleteAlertConfiguration(formData: FormData) {
  const context = await requireOrganizationManagementContext();
  const parsed = z.object({ id: z.string().uuid() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard/settings/alerts?error=invalid");
  const supabase = await createSupabaseServerClient();
  const orgId = context.organization?.id;
  if (!orgId) redirect("/dashboard/settings/alerts?error=denied");
  const { error } = await supabase.from("alert_configurations").delete().eq("id", parsed.data.id).eq("organization_id", orgId);
  redirect(error ? "/dashboard/settings/alerts?error=denied" : "/dashboard/settings/alerts?deleted=1");
}
