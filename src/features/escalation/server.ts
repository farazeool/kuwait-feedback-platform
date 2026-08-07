import "server-only";

import { requireAppAccessContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anySb = (supabase: any) => supabase;

export async function listEscalationRules() {
  const context = await requireAppAccessContext();
  if (!context.organization) return { context, rules: [] };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = anySb(await createSupabaseServerClient()) as any;
  const { data } = await supabase
    .from("escalation_rules")
    .select("id, survey_id, location_id, trigger_type, threshold_value, keywords, auto_create_alert, auto_assign_investigation, auto_notify_manager, severity, is_active, created_at")
    .eq("organization_id", context.organization.id)
    .order("created_at", { ascending: false });

  return { context, rules: data ?? [] };
}

export async function getEscalationRule(ruleId: string) {
  const context = await requireAppAccessContext();
  if (!context.organization) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = anySb(await createSupabaseServerClient()) as any;
  const { data } = await supabase
    .from("escalation_rules")
    .select("id, survey_id, location_id, trigger_type, threshold_value, keywords, auto_create_alert, auto_assign_investigation, auto_notify_manager, severity, is_active, created_at")
    .eq("id", ruleId)
    .eq("organization_id", context.organization.id)
    .single();

  return data ?? null;
}
