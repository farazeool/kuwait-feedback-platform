import "server-only";

import { z } from "zod";

import { requirePlatformAdminContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const organizationSchema = z.object({
  id: z.string().uuid(), slug: z.string(), name_en: z.string(), name_ar: z.string(),
  status: z.enum(["active", "archived"]), created_at: z.string(), member_count: z.number(),
  location_count: z.number(), survey_count: z.number(), response_count: z.number(), storage_objects: z.number(),
});
const overviewSchema = z.object({
  organizations: z.array(organizationSchema), active_organizations: z.number(), inactive_organizations: z.number(),
});

export async function getPlatformOverview() {
  const context = await requirePlatformAdminContext();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_platform_overview");
  if (error) throw new Error("Platform overview unavailable");
  return { context, overview: overviewSchema.parse(data) };
}

export async function getPlatformOrganization(organizationId: string) {
  const result = await getPlatformOverview();
  const organization = result.overview.organizations.find((item) => item.id === organizationId);
  if (!organization) return null;
  return { ...result, organization };
}

export async function getPlatformAudit() {
  const context = await requirePlatformAdminContext();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("audit_logs").select("id, organization_id, actor_id, action, table_name, created_at").not("table_name", "in", "(survey_answers,survey_responses)").order("created_at", { ascending: false }).limit(100);
  if (error) throw new Error("Platform audit unavailable");
  return { context, audit: data ?? [] };
}
