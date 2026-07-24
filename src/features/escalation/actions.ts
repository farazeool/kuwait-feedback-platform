"use server";

import { redirect } from "next/navigation";

import { requireOrganizationManagementContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { escalationRuleSchema } from "./schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anySb = (supabase: any) => supabase;

export async function createEscalationRule(formData: FormData) {
  const context = await requireOrganizationManagementContext();
  if (!context.organization) redirect("/dashboard/settings/channels/escalation?error=denied");

  const raw = Object.fromEntries(formData);
  const parsed = escalationRuleSchema.safeParse({
    ...raw,
    thresholdValue: raw.thresholdValue ? Number(raw.thresholdValue) : undefined,
    autoCreateAlert: raw.autoCreateAlert === "on",
    autoAssignInvestigation: raw.autoAssignInvestigation === "on",
    autoNotifyManager: raw.autoNotifyManager === "on",
    keywords: raw.keywords ? String(raw.keywords).split(",").map((k: string) => k.trim()).filter(Boolean) : undefined,
  });

  if (!parsed.success) redirect("/dashboard/settings/channels/escalation?error=invalid");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = anySb(await createSupabaseServerClient()) as any;
  const v = parsed.data;

  const { error } = await supabase.from("escalation_rules").insert({
    organization_id: context.organization.id,
    survey_id: v.surveyId || null,
    location_id: v.locationId || null,
    trigger_type: v.triggerType,
    threshold_value: v.thresholdValue ?? null,
    keywords: v.keywords ?? null,
    auto_create_alert: v.autoCreateAlert,
    auto_assign_investigation: v.autoAssignInvestigation,
    auto_notify_manager: v.autoNotifyManager,
    severity: v.severity,
  });

  redirect(error
    ? "/dashboard/settings/channels/escalation?error=denied"
    : "/dashboard/settings/channels/escalation?created=1");
}

export async function updateEscalationRule(formData: FormData) {
  const context = await requireOrganizationManagementContext();
  if (!context.organization) redirect("/dashboard/settings/channels/escalation?error=denied");

  const ruleId = formData.get("ruleId") as string;
  if (!ruleId) redirect("/dashboard/settings/channels/escalation?error=invalid");

  const raw = Object.fromEntries(formData);
  const parsed = escalationRuleSchema.safeParse({
    ...raw,
    thresholdValue: raw.thresholdValue ? Number(raw.thresholdValue) : undefined,
    autoCreateAlert: raw.autoCreateAlert === "on",
    autoAssignInvestigation: raw.autoAssignInvestigation === "on",
    autoNotifyManager: raw.autoNotifyManager === "on",
    keywords: raw.keywords ? String(raw.keywords).split(",").map((k: string) => k.trim()).filter(Boolean) : undefined,
  });

  if (!parsed.success) redirect("/dashboard/settings/channels/escalation?error=invalid");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = anySb(await createSupabaseServerClient()) as any;
  const v = parsed.data;

  const { error } = await supabase
    .from("escalation_rules")
    .update({
      survey_id: v.surveyId || null,
      location_id: v.locationId || null,
      trigger_type: v.triggerType,
      threshold_value: v.thresholdValue ?? null,
      keywords: v.keywords ?? null,
      auto_create_alert: v.autoCreateAlert,
      auto_assign_investigation: v.autoAssignInvestigation,
      auto_notify_manager: v.autoNotifyManager,
      severity: v.severity,
    })
    .eq("id", ruleId)
    .eq("organization_id", context.organization.id);

  redirect(error
    ? "/dashboard/settings/channels/escalation?error=denied"
    : "/dashboard/settings/channels/escalation?updated=1");
}

export async function toggleEscalationRule(formData: FormData) {
  const context = await requireOrganizationManagementContext();
  if (!context.organization) redirect("/dashboard/settings/channels/escalation?error=denied");

  const ruleId = formData.get("ruleId") as string;
  const isActive = formData.get("isActive") === "true";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = anySb(await createSupabaseServerClient()) as any;
  await supabase
    .from("escalation_rules")
    .update({ is_active: isActive })
    .eq("id", ruleId)
    .eq("organization_id", context.organization.id);

  redirect("/dashboard/settings/channels/escalation?updated=1");
}

export async function deleteEscalationRule(formData: FormData) {
  const context = await requireOrganizationManagementContext();
  if (!context.organization) redirect("/dashboard/settings/channels/escalation?error=denied");

  const ruleId = formData.get("ruleId") as string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = anySb(await createSupabaseServerClient()) as any;
  await supabase
    .from("escalation_rules")
    .delete()
    .eq("id", ruleId)
    .eq("organization_id", context.organization.id);

  redirect("/dashboard/settings/channels/escalation?deleted=1");
}
