import { getAppAccessContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type AlertConfiguration = Database["public"]["Tables"]["alert_configurations"]["Row"];
type AlertConfigInsert = Database["public"]["Tables"]["alert_configurations"]["Insert"];
type AlertConfigUpdate = Database["public"]["Tables"]["alert_configurations"]["Update"];
type AppRole = Database["public"]["Enums"]["app_role"];
type AlertRuleType = Database["public"]["Enums"]["alert_rule_type"];
type AlertSeverity = Database["public"]["Enums"]["alert_severity"];
type EntityStatus = Database["public"]["Enums"]["entity_status"];

export type AlertConfigListItem = AlertConfiguration & {
  location: { id: string; name_en: string; name_ar: string } | null;
};

export async function listAlertConfigurations() {
  const context = await getAppAccessContext();
  if (!context) throw new Error("Authentication required");
  const supabase = await createSupabaseServerClient();
  const organizationId = context.organization?.id;
  if (!organizationId) return { context, rows: [], locations: [] };
  const [{ data: rows }, { data: locations }] = await Promise.all([
    supabase.from("alert_configurations").select("*").eq("organization_id", organizationId).order("rule_type"),
    supabase.from("locations").select("id, name_en, name_ar").eq("organization_id", organizationId).eq("status", "active").order("name_en"),
  ]);
  return { context, rows: (rows ?? []) as AlertConfiguration[], locations: locations ?? [] };
}

export async function getAlertConfiguration(configId: string) {
  const context = await getAppAccessContext();
  if (!context) throw new Error("Authentication required");
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("alert_configurations").select("*").eq("id", configId).maybeSingle();
  if (!data) throw new Error("Configuration not found");
  return { context, config: data as AlertConfiguration };
}
